import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { startStack } from "./stack.mjs";
import { DeltaClient } from "../server/delta-sdk.mjs";
const stack = await startStack();
try {
  const { client } = stack;
  const task = await client.call("vector.task_create", {
    data: { title: "Real Core task", scheduledDate: "2026-10-17" },
    requestId: randomUUID(),
  });
  await client.call("vector.entry_create", {
    data: { text: "Private diary" },
    requestId: randomUUID(),
  });
  await stack.restartVector();
  assert.equal((await client.call("vector.task_list")).items[0].id, task.id);
  const catalog = await client.call("mcp.catalog");
  assert(
    catalog.some(
      (c) =>
        c.name === "vector.task_create" && c.pluginId === "dev.delta.vector",
    ),
  );
  const created = await client.call("mcp.create", {
    profile: {
      name: "Vector scoped acceptance",
      capabilities: ["vector.task_list", "vector.task_create"],
      plugins: ["dev.delta.vector"],
    },
  });
  const profile = { ...created.profile, secret: created.secret };
  // The gateway secret is deliberately kept only in process memory.
  const rpc = async (method, params) => {
    const r = await fetch(stack.mcpUrl + "/mcp/" + profile.id, {
      method: "POST",
      headers: {
        authorization: "Bearer " + profile.secret,
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    return await r.json();
  };
  const tools = await rpc("tools/list");
  assert(tools.result.tools.some((t) => t.name === "vector__task_create"));
  assert(!tools.result.tools.some((t) => t.name === "vector__entry_list"));
  const res = await rpc("tools/call", {
    name: "vector__task_create",
    arguments: {
      data: { title: "Created through real MCP" },
      requestId: randomUUID(),
    },
  });
  assert(!res.error);
  assert(!res.result?.isError);
  assert.equal((await client.call("vector.task_list")).total, 2);
  const denied = await rpc("tools/call", {
    name: "vector__entry_list",
    arguments: {},
  });
  assert(denied.error || denied.result?.isError);
  const scoped = new DeltaClient(
    stack.url,
    await stack.token("task-only", ["call:vector.task_list"]),
  );
  await assert.rejects(scoped.call("vector.entry_list"), { code: "forbidden" });
  const profileList = await client.call("mcp.list");
  assert(!JSON.stringify(profileList).includes(profile.secret));
  await client.call("mcp.revoke", { id: profile.id });
  const revoked = await rpc("tools/list");
  assert(revoked.error || !revoked.result);
  console.log(
    "PASS real Core 0.4.4 → Vector → real Storage documents; process restart; MCP discovery, scoped create/list, journal denial and revocation",
  );
} finally {
  await stack.stop();
}
