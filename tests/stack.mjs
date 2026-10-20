import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { DeltaClient } from "../server/delta-sdk.mjs";
export async function freePort() {
  const s = createServer();
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const port = s.address().port;
  await new Promise((r) => s.close(r));
  return port;
}
export async function startStack({ includeLifeOS = true, includeMCP = true } = {}) {
  const home = await mkdtemp(join(tmpdir(), "delta-lifeos-live-")),
    port = await freePort(),
    mcpPort = await freePort(),
    url = "http://127.0.0.1:" + port,
    children = [],
    logs = [];
  const env = { ...process.env, DELTA_HOME: home };
  const core = process.env.CORE_BINARY || "/data/tools/delta";
  execFileSync(
    core,
    [
      "init",
      "--name",
      "LifeOS acceptance",
      "--kind",
      "container",
      "--port",
      String(port),
    ],
    { env, stdio: "ignore" },
  );
  const admin = (await readFile(join(home, "admin.token"), "utf8")).trim();
  const client = new DeltaClient(url, admin);
  const start = (name, command, args, extra = {}) => {
    const p = spawn(command, args, {
      cwd: resolve("."),
      env: { ...env, DELTA_URL: url, ...extra },
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.push(p);
    for (const stream of [p.stdout, p.stderr])
      stream.on("data", (b) => logs.push(name + ": " + b.toString()));
    return p;
  };
  async function wait(check) {
    let error;
    for (let i = 0; i < 160; i++) {
      try {
        if (await check()) return;
      } catch (e) {
        error = e;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error(
      "Service did not become ready: " +
        (error?.code || "timeout") +
        " " +
        logs.join("").replace(/dlt_[a-zA-Z0-9_-]+/g, "[redacted]"),
    );
  }
  const stop = async () => {
    for (const p of children.reverse()) p.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 200));
    for (const p of children) if (p.exitCode === null) p.kill("SIGKILL");
    await rm(home, { recursive: true, force: true });
  };
  try {
    start("core", core, ["run"]);
    await wait(() => client.call("core.info"));
    const token = async (name, scopes) =>
      (await client.call("tokens.create", { name, scopes })).token;
    const storageToken = await token("dev.delta.db", ["register:storage"]);
    start("storage", "node", ["tests/storage-runner.mjs"], {
      DELTA_TOKEN: storageToken,
      TEST_STORAGE_FILE: join(home, "storage.json"),
    });
    await wait(async () =>
      (await client.call("core.components")).some((c) => c.id === "storage"),
    );
    let lifeosToken, lifeos;
    if (includeLifeOS) {
      lifeosToken = await token("dev.delta.lifeos", [
        "register:lifeos",
        "call:storage.document_get",
        "call:storage.document_put",
      ]);
      lifeos = start("lifeos", "node", ["server/main.mjs"], {
        DELTA_TOKEN: lifeosToken,
      });
      await wait(async () =>
        (await client.call("core.components")).some((c) => c.id === "lifeos"),
      );
    }
    if (includeMCP) { start("mcp", "node", ["../delta-mcp/server/main.mjs"], {
      DELTA_TOKEN: admin,
      DATA_DIR: join(home, "mcp"),
      PORT: String(mcpPort),
    });
    await wait(async () =>
      (await client.call("core.components")).some((c) => c.id === "mcp"),
    );
    }
    return {
      client,
      home,
      url,
      mcpUrl: "http://127.0.0.1:" + mcpPort,
      admin,
      token,
      stop,
      wait,
      async restartLifeOS() {
        if (!lifeos) throw Error("LifeOS was not started by this test stack");
        lifeos.kill("SIGKILL");
        await new Promise((r) => setTimeout(r, 250));
        lifeos = start("lifeos", "node", ["server/main.mjs"], {
          DELTA_TOKEN: lifeosToken,
        });
        await wait(async () => {
          try {
            return (await client.call("lifeos.status")).storage === "connected";
          } catch {
            return false;
          }
        });
      },
    };
  } catch (e) {
    await stop();
    throw e;
  }
}
