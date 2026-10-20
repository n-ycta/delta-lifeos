import { createServer } from "vite";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createBridge } from "../../delta-web/server/bridge.mjs";
import { createProfiles } from "../../delta-web/server/profile.mjs";
import { createWorkspaces } from "../../delta-web/server/workspaces.mjs";
/** Real Console, installed released iframe and real broker/Core. No mock adapter. */
export async function verifyCatalogConsole(stack, api) {
  const oldData = process.env.DATA_DIR;
  process.env.DATA_DIR = stack.home + "/web-console";
  const handlers = {
    ...createBridge(stack.client),
    ...createProfiles(),
    ...createWorkspaces(),
  };
  if (oldData === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = oldData;
  const caller = {
    kind: "token",
    name: "catalog-acceptance",
    scopes: ["admin"],
  };
  const webCall = (capability, args = {}) => handlers[capability](args, caller);
  const root = fileURLToPath(new URL("../../delta-ui", import.meta.url));
  const output = process.env.QA_DIR || "/data/lifeos-catalog-qa";
  await mkdir(output, { recursive: true });
  const server = await createServer({
    root,
    configFile: root + "/vite.config.ts",
    server: { host: "127.0.0.1", port: 0 },
    plugins: [
      {
        name: "acceptance-real-stack",
        configureServer(s) {
          s.middlewares.use("/__accept/call", async (req, res) => {
            res.setHeader("content-type", "application/json");
            try {
              let body = "";
              for await (const b of req) {
                body += b;
                if (body.length > 65536) throw Error("payload_limit");
              }
              const r = JSON.parse(body);
              let value;
              if (r.capability.startsWith("host.apps_")) {
                const result = await api(
                  r.capability.slice(10),
                  r.args && Object.keys(r.args).length ? r.args : undefined,
                );
                value = await result.json();
                if (!result.ok)
                  throw Object.assign(Error(value.error), {
                    code: value.error,
                  });
              } else if (r.capability.startsWith("lifeos.")) {
                const result = await api("call", {
                  capability: r.capability,
                  args: r.args || {},
                });
                value = await result.json();
                if (!result.ok)
                  throw Object.assign(Error(value.error), {
                    code: value.error,
                  });
              } else if (handlers[r.capability])
                value = await webCall(r.capability, r.args || {});
              else value = await stack.client.call(r.capability, r.args || {});
              res.end(JSON.stringify(value));
            } catch (e) {
              res.statusCode = 500;
              res.end(
                JSON.stringify({
                  code: e.code || "unavailable",
                  message: e.message,
                }),
              );
            }
          });
          s.middlewares.use("/__accept", async (req, res) => {
            res.setHeader("content-type", "text/html");
            res.end(
              await s.transformIndexHtml(
                "/__accept",
                '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/catalog-console.fixture.tsx"></script></body></html>',
              ),
            );
          });
        },
      },
    ],
  });
  await server.listen();
  const oldPort = process.env.PORT;
  process.env.PORT = String(server.httpServer.address().port);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/local/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() =>
        localStorage.setItem("delta.language", "en"),
      );
      await page.goto(
        `http://127.0.0.1:${server.httpServer.address().port}/__accept#/dashboards`,
      );
      // Same dock/application route and persistent root FrameHost as Media.
      const launcher=page.locator('.dx-dock button[title="Delta LifeOS"]');
      await launcher.waitFor();await launcher.click();
      const appFrame=page.frameLocator('iframe[title="dev.delta.lifeos"]').first();
      await appFrame.locator('html[data-lifeos-connected=true]').waitFor({timeout:30000});
      await appFrame.locator('#body').fill('LifeOS app switch persistence '+width);
      await page.waitForTimeout(1200);
      await appFrame.locator('html').evaluate(()=>{window.__lifeosFrameMarker='same-running-frame'});
      await page.locator('.dx-dock button').filter({has:page.locator('[data-kind="console"]')}).first().click();
      await launcher.click();
      assert.equal(await appFrame.locator('html').evaluate(()=>window.__lifeosFrameMarker),'same-running-frame');
      assert.match(await appFrame.locator('#body').inputValue(),/app switch persistence/);
      await page.screenshot({path:`${output}/lifeos-app-tab-${width}.png`,animations:'disabled'});
      await page.locator('.dx-dock button').filter({has:page.locator('[data-kind="console"]')}).first().click();
      const card = page.locator(
        'a.plug[href="#/dashboards/gen_ui_dev.delta.lifeos"]',
      );
      await card.waitFor();
      await card.click();
      const frame = page
        .frameLocator('iframe[title="dev.delta.lifeos"][src*="surface=today"]')
        .first();
      try {
        await frame
          .locator("html[data-lifeos-connected=true]")
          .waitFor({ timeout: 30000 });
      } catch (e) {
        await page.screenshot({ path: output + "/failure.png" });
        console.log(
          "frames",
          page.frames().map((f) => f.url()),
        );
        console.log(
          "body",
          (await page.locator("body").innerText()).slice(-1600),
        );
        throw e;
      }
      const text = "Actual published release dashboard capture " + width;
      await frame.locator("#capture-text").fill(text);
      await frame.locator("#capture-form button[type=submit]").click();
      await stack.wait(async () =>
        (await stack.client.call("lifeos.entry_list")).items.some(
          (e) => e.text === text,
        ),
      );
      await page.screenshot({
        path: `${output}/released-dashboard-${width}.png`,
        animations: "disabled",
      });
      await page.getByRole("button", { name: "Widget", exact: true }).click();
      const drawer = page.getByRole("dialog");
      await drawer.waitFor();
      const panel = drawer
        .locator(".panel")
        .filter({ hasText: "Delta LifeOS" });
      assert.equal(await panel.locator(".viz-option").count(), 14);
      await panel
        .getByRole("button", { name: "Calendar", exact: true })
        .click();
      await drawer.getByRole("button", { name: "Add", exact: true }).click();
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.reload();
      await page.locator(".dx-widget-app").nth(1).waitFor();
      const saved = (await webCall("web.dashboards_list")).find(
        (d) => d.id === "gen_ui_dev.delta.lifeos",
      );
      assert(saved.widgets.some((w) => w.display.surface === "calendar"));
      assert.equal(saved.widgets.length, 2);
      assert.deepEqual(errors, []);
      await page.close();
      // The next viewport must start from the same uncustomized generated starter.
      await webCall("web.dashboards_delete", { id: "gen_ui_dev.delta.lifeos" });
    }
    console.log(
      "PASS real Console → automatic LifeOS dashboard → published isolated iframe → actual journal write through Web broker/Core/Storage; Calendar widget add/save/reload at 1440 and 390px.",
    );
  } finally {
    await browser.close();
    await server.close();
    if (oldPort === undefined) delete process.env.PORT;
    else process.env.PORT = oldPort;
  }
}
