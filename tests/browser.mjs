import { chromium } from "playwright";
import { createServer } from "vite";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { startStack, freePort } from "./stack.mjs";
import { capabilities } from "../server/contract.mjs";
const stack = await startStack(),
  pluginPort = await freePort(),
  hostPort = await freePort(),
  output = process.env.QA_DIR || "/data/vector-qa";
await mkdir(output, { recursive: true });
let failing = false;
const errors = [];
const pluginServer = await createServer({
  configFile: "vite.config.ts",
  server: { port: pluginPort, strictPort: true, host: "127.0.0.1" },
});
await pluginServer.listen();
const hostServer = await createServer({
  configFile: "vite.config.ts",
  server: { port: hostPort, strictPort: true, host: "127.0.0.1" },
  plugins: [
    {
      name: "test-core-proxy",
      configureServer(server) {
        server.middlewares.use("/test-api", async (req, res) => {
          try {
            if (failing) throw Error("unavailable");
            let body = "";
            for await (const chunk of req) {
              body += chunk;
              if (body.length > 64000) throw Error("limit");
            }
            const a = JSON.parse(body);
            if (!capabilities.includes(a.capability) || a.node)
              throw Error("forbidden");
            const result = await stack.client.call(a.capability, a.args || {});
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ result }));
          } catch (e) {
            res.statusCode = 503;
            res.end(JSON.stringify({ error: e.code || "operation_failed" }));
          }
        });
      },
    },
  ],
});
await hostServer.listen();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/local/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => void d.accept());
  const open = async (opts = {}) => {
    const q = new URLSearchParams({
      plugin: "http://127.0.0.1:" + pluginPort,
      ...opts,
    });
    await page.goto("http://127.0.0.1:" + hostPort + "/tests/host.html?" + q);
    const f = page.frameLocator("iframe").first();
    await f.locator("html[data-vector-connected=true]").waitFor();
    return f;
  };
  let f = await open();
  await f.getByRole("button", { name: "Задача", exact: true }).click();
  await f.locator("dialog [name=title]").fill("Разобрать ошибки парсера");
  await f.locator("dialog [name=estimateMinutes]").fill("25");
  await f.locator("dialog .delta-select-trigger").first().click();
  await f.locator("dialog .delta-select-popup").waitFor();
  await f.locator("dialog .delta-select-popup").press("ArrowDown");
  await f.locator("dialog .delta-select-popup").press("Enter");
  assert.equal(await f.locator("dialog [name=status]").inputValue(), "planned");
  await f
    .locator("dialog [name=checklist]")
    .fill("Некорректный ввод\nПустая строка");
  await f.locator("dialog button[type=submit]").click();
  await f
    .locator(".task-title")
    .filter({ hasText: "Разобрать ошибки парсера" })
    .waitFor();
  assert.equal(await f.locator("dialog[open]").count(), 0);
  await f
    .locator("#capture-text")
    .fill("Сегодня сделал маленький шаг. Без гонки за галочками.");
  await f.locator("#capture-form button[type=submit]").click();
  await f.locator("#capture-text").filter({ hasText: "" }).waitFor();
  await page.waitForTimeout(300);
  assert.equal(await f.locator("#capture-text").inputValue(), "");
  await page.screenshot({ path: output + "/today-latte-desktop.png" });
  await f.locator("[data-view=tasks]").click();
  await f.locator("[data-complete]").first().click();
  await f.locator(".task-title.done").waitFor();
  await f.locator("[data-complete]").first().click();
  await f.locator(".task-title:not(.done)").waitFor();
  await f.locator('[data-edit^="task:"]').first().click();
  await f.locator("dialog [name=title]").fill("Парсер — исправлено");
  await f.locator("dialog button[type=submit]").click();
  await f
    .locator(".task-title")
    .filter({ hasText: "Парсер — исправлено" })
    .waitFor();
  await f.locator('[data-edit^="task:"]').first().click();
  await f
    .locator("dialog [name=description]")
    .fill("Повторное открытие формы не создаёт дубли");
  await f.locator("dialog button[type=submit]").click();
  await page.waitForTimeout(300);
  assert.equal((await stack.client.call("vector.task_list")).total, 1);
  await f.locator("[data-view=practices]").click();
  await f.locator("[data-new=practice]").click();
  await f.locator("dialog [name=title]").fill("Английский: пересказать абзац");
  await f
    .locator("dialog [name=minimum]")
    .fill("Одно предложение своими словами");
  await f.locator("dialog button[type=submit]").click();
  await f.locator("[data-log]").waitFor();
  await f.locator("[data-log]").click();
  await f.locator("dialog [name=value]").fill("10");
  await f.locator("dialog [name=unit]").fill("мин");
  await f.locator("dialog button[type=submit]").click();
  await f.locator("dialog[open]").waitFor({ state: "hidden" });
  await f.locator("[data-view=journal]").click();
  await f.locator(".entry").first().waitFor();
  assert((await f.locator(".entry").count()) >= 2);
  await page.screenshot({ path: output + "/journal-latte-desktop.png" });
  await f.locator("[data-view=calendar]").click();
  await f.locator(".calendar-grid").waitFor();
  await page.screenshot({ path: output + "/calendar-latte-desktop.png" });
  await f.locator("[data-view=projects]").click();
  await f.locator("[data-new=project]").click();
  await f.locator("dialog [name=title]").fill("Первый самостоятельный парсер");
  await f.locator("dialog [name=nextStep]").fill("Обработать пустую строку");
  await f.locator("dialog button[type=submit]").click();
  await f.locator(".entity-card").first().waitFor();
  await f.locator("[data-view=skills]").click();
  await f.locator("[data-new=skill]").click();
  await f.locator("dialog [name=title]").fill("Rust: обработка ошибок");
  await f.locator("dialog button[type=submit]").click();
  await f.locator("[data-evidence]").waitFor();
  await f.locator("[data-evidence]").click();
  await f.locator("dialog [name=title]").fill("Обработал Result без генерации");
  await f.locator("dialog button[type=submit]").click();
  await f.locator(".evidence-row").waitFor();
  await page.screenshot({ path: output + "/skills-latte-desktop.png" });
  await f.locator("[data-view=review]").click();
  await f.locator(".stats").waitFor();
  await page.screenshot({ path: output + "/review-latte-desktop.png" });
  await f.locator("[data-view=settings]").click();
  await f.locator("[name=timezone]").fill("Asia/Yekaterinburg");
  await f.locator("#settings-form button[type=submit]").click();
  await page.waitForTimeout(300);
  assert.equal(
    (await stack.client.call("vector.settings_get")).timezone,
    "Asia/Yekaterinburg",
  );
  await page.screenshot({ path: output + "/settings-latte-desktop.png" });
  for (const skin of ["latte", "gruvbox", "mocha", "tokyo"]) {
    for (const lang of ["ru", "en"]) {
      f = await open({ skin, lang });
      assert.equal(
        await f.locator("html").getAttribute("data-delta-skin"),
        skin,
      );
      assert((await f.locator("nav svg").count()) > 5);
      assert.equal(await f.locator("nav img").count(), 0);
      assert(
        await f
          .locator(".primary")
          .first()
          .evaluate((el) => {
            const probe = document.createElement("span");
            probe.style.backgroundColor = "var(--ink)";
            el.append(probe);
            const matches =
              getComputedStyle(el).backgroundColor ===
              getComputedStyle(probe).backgroundColor;
            probe.remove();
            return matches;
          }),
      );
      await page.screenshot({ path: output + `/today-${skin}-${lang}.png` });
    }
  }
  for (const surface of [
    "capture",
    "tasks",
    "journal",
    "calendar",
    "practices",
    "projects",
    "skills",
    "review",
  ]) {
    f = await open({ surface, skin: "latte" });
    assert(
      await f
        .locator("body")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    );
    await page.screenshot({ path: output + `/surface-${surface}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  f = await open({ skin: "mocha", lang: "ru" });
  assert(
    await f.locator(".brand").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth && r.height > 0;
    }),
  );
  await page.screenshot({ path: output + "/today-mocha-mobile.png" });
  assert(
    await f.locator("body").evaluate((el) => el.scrollWidth <= el.clientWidth),
  );
  await f.locator("[data-view=calendar]").click();
  await page.screenshot({ path: output + "/calendar-mocha-mobile.png" });
  await f.locator("[data-day]").first().click();
  await f.locator("[data-new=task]").click();
  assert.notEqual(
    await f
      .locator("dialog input")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(246, 247, 250)",
  );
  await page.screenshot({ path: output + "/editor-mocha-mobile.png" });
  assert(
    await f
      .locator("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  );
  await f.locator("#cancel-dialog").click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  f = await open({ multi: "1", skin: "gruvbox" });
  assert.equal(await page.locator("iframe").count(), 2);
  await page.frameLocator("iframe").nth(1).locator("#capture-form").waitFor();
  await page.screenshot({ path: output + "/two-surfaces.png" });
  await page.setViewportSize({ width: 320, height: 700 });
  f = await open({ surface: "today", skin: "tokyo" });
  await page.screenshot({ path: output + "/embedded-320.png" });
  assert(
    await f.locator("body").evaluate((el) => el.scrollWidth <= el.clientWidth),
  );
  f = await open();
  await f.locator("#capture-text").fill("Черновик должен остаться");
  failing = true;
  await f.locator("#capture-form button[type=submit]").click();
  await f.locator("#notice:not([hidden])").waitFor();
  assert.equal(
    await f.locator("#capture-text").inputValue(),
    "Черновик должен остаться",
  );
  await page.screenshot({ path: output + "/connection-error.png" });
  failing = false;
  await f.locator("#capture-form button[type=submit]").click();
  await page.waitForTimeout(300);
  assert.equal(await f.locator("#capture-text").inputValue(), "");
  await page.reload();
  await page
    .frameLocator("iframe")
    .locator("[data-new=task]")
    .first()
    .waitFor();
  assert.equal((await stack.client.call("vector.task_list")).total, 1);
  assert.deepEqual(errors, []);
  console.log(
    "PASS browser → real SDK channel → real Core → Storage: CRUD, complete/reopen, diary, practice, skills, calendar, settings, reload, error recovery; 4 themes × RU/EN; mobile/320px; two simultaneous surfaces.",
  );
} finally {
  await browser.close();
  await hostServer.close();
  await pluginServer.close();
  await stack.stop();
}
