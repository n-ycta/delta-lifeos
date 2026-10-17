// Acceptance: actual public catalog → Core installer → released service → durable Storage.
import assert from "node:assert/strict";
import { verifyCatalogConsole } from "./catalog-console.mjs";
import { startStack, freePort } from "./stack.mjs";
import { DeltaClient } from "../server/delta-sdk.mjs";
import { createServer, request } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createApps } from "../../delta-web/server/apps.mjs";
const stack = await startStack({ includeVector: false });
try {
  let item;
  for (let attempt = 0; attempt < 60; attempt++) {
    const catalog = await stack.client.call("packages.catalog");
    item = catalog.plugins.find((p) => p.id === "dev.delta.vector");
    if (item) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  assert(
    item,
    "Vector must be visible in the actual public Core install catalog",
  );
  assert.equal(item.version, "0.1.0");
  const plan = await stack.client.call("packages.plan", { id: item.id });
  assert.deepEqual(
    plan.items.map((i) => i.id),
    [item.id],
  );
  const result = await stack.client.call("packages.install", {
    id: item.id,
    expectedVersion: item.version,
    expectedSha256: item.sha256,
  });
  let job;
  for (let attempt = 0; attempt < 180; attempt++) {
    job = (await stack.client.call("packages.jobs")).find(
      (j) => j.id === result.jobId,
    );
    if (job?.status !== "installing") break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(job?.status, "complete", JSON.stringify(job?.error || {}));
  assert.equal((await stack.client.call("vector.status")).storage, "connected");
  const task = await stack.client.call("vector.task_create", {
    requestId: crypto.randomUUID(),
    data: { title: "Installed from the official catalog" },
  });
  const entry = await stack.client.call("vector.entry_create", {
    requestId: crypto.randomUUID(),
    data: { text: "Catalog installation acceptance" },
  });
  await stack.client.call("supervisor.restart", { id: "vector" });
  await stack.wait(async () => {
    try {
      return (await stack.client.call("vector.task_list")).items.some(
        (t) => t.id === task.id,
      );
    } catch {
      return false;
    }
  });
  assert(
    (await stack.client.call("vector.entry_list")).items.some(
      (e) => e.id === entry.id,
    ),
  );
  const uiCatalog = JSON.parse(
    await readFile(
      new URL("../../delta-ui/app-catalog.json", import.meta.url),
      "utf8",
    ),
  );
  const appPort = await freePort();
  const apps = await createApps(
    stack.client,
    { credential: () => undefined },
    {
      root: join(stack.home, "web-ui"),
      catalog: uiCatalog,
      noListen: true,
      origin: "http://{app}.localhost:" + appPort,
      authorize: async (token) => {
        await new DeltaClient(stack.url, token).call("tokens.list");
        return { principal: { scopes: ["admin"] } };
      },
    },
  );
  const web = createServer(async (req, res) => {
    await apps.http(req, res, new URL(req.url, "http://localhost").pathname);
  });
  await new Promise((r) => web.listen(0, "127.0.0.1", r));
  await new Promise((r) => apps.staticServer.listen(appPort, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + web.address().port;
  const api = async (method, args) =>
    fetch(base + "/apps/" + method, {
      method: args ? "POST" : "GET",
      headers: {
        authorization: "Bearer " + stack.admin,
        origin: base,
        "content-type": "application/json",
      },
      ...(args ? { body: JSON.stringify({ id: item.id, ...args }) } : {}),
    });
  try {
    assert((await (await api("catalog")).json()).some((a) => a.id === item.id));
    const installed = await api("install", {});
    assert.equal(installed.status, 200);
    const ui = (await (await api("list")).json()).find((a) => a.id === item.id);
    assert.equal(ui.ui.surfaces.length, 9);
    const launched = await (await api("launch", {})).json();
    const entry = await new Promise((resolve, reject) => {
      request(
        {
          hostname: "127.0.0.1",
          port: appPort,
          path: "/index.html",
          headers: { host: new URL(launched.url).host },
        },
        (res) => {
          let text = "";
          res.on("data", (b) => (text += b));
          res.on("end", () => resolve({ status: res.statusCode, text }));
        },
      )
        .on("error", reject)
        .end();
    });
    assert.equal(entry.status, 200);
    assert(entry.text.includes("index-"));
    const tasks = await api("call", { capability: "vector.task_list" });
    assert.equal(tasks.status, 200);
    assert((await tasks.json()).items.some((t) => t.id === task.id));
    assert.equal(
      (await api("call", { capability: "tokens.create" })).status,
      403,
    );
    await verifyCatalogConsole(stack, api);
  } finally {
    await new Promise((r) => web.close(r));
    await new Promise((r) => apps.staticServer.close(r));
  }
  console.log(
    "PASS published UI catalog → real Web app installer → released checksum-verified UI → nine surfaces and isolated launch assets → Web broker → installed Vector service; admin capability denied.",
  );
  console.log(
    "PASS actual public Core catalog → dependency plan → verified GitHub release installation → supervisor registration → tasks/journal → durable Storage after supervisor restart.",
  );
} finally {
  await stack.client
    .call("supervisor.remove", { id: "vector", force: true })
    .catch(() => {});
  await stack.stop();
}
