import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createVector, localDate } from "../server/vector.mjs";
import { filePersistence } from "../server/persistence.mjs";
import { capabilities, manifest, appManifest } from "../server/contract.mjs";
const owner = { kind: "token", name: "owner", scopes: ["admin"] };
let seq = 0;
async function setup(fn) {
  const dir = await mkdtemp(join(tmpdir(), "vector-"));
  try {
    const persistence = filePersistence(dir),
      h = await createVector({
        persistence,
        now: () => "2026-10-17T13:35:00.000Z",
      });
    const call = (op, a = {}, c = owner) =>
      h["vector." + op](
        {
          ...a,
          ...(!op.endsWith("_list") &&
          !["summary", "calendar", "settings_get", "status", "export"].includes(
            op,
          )
            ? { requestId: a.requestId || "req-" + ++seq }
            : {}),
        },
        c,
      );
    await fn({ dir, h, call, persistence });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test("contract is complete and surfaces are shared with stable IDs", () => {
  assert.equal(new Set(capabilities).size, capabilities.length);
  assert.equal(manifest.capabilities.length, capabilities.length);
  assert(appManifest.ui.surfaces.some((s) => s.id === "tasks"));
  assert(appManifest.ui.surfaces.every((s) => s.instance === "shared"));
});
test("task lifecycle, optimistic conflicts, durable restart and completion facts", () =>
  setup(async ({ call, persistence, dir }) => {
    const x = await call("task_create", {
      data: { title: "Parse input", scheduledDate: "2026-10-17" },
    });
    const update = await call("task_update", {
      id: x.id,
      revision: 1,
      data: { description: "Do it" },
    });
    assert.equal(update.revision, 2);
    await assert.rejects(call("task_complete", { id: x.id, revision: 1 }), {
      code: "conflict",
    });
    const done = await call("task_complete", { id: x.id, revision: 2 });
    assert.equal(done.status, "done");
    assert.equal(
      (await call("summary", { from: "2026-10-17", to: "2026-10-17" }))
        .completed,
      1,
    );
    const h = await createVector({ persistence });
    assert.equal(
      (await h["vector.task_list"]({}, owner)).items[0].status,
      "done",
    );
    assert.equal((await stat(join(dir, "vector.json"))).mode & 0o777, 0o600);
    assert.equal(
      (await call("task_reopen", { id: x.id, revision: 3 })).status,
      "inbox",
    );
  }));
test("idempotency persists across restart and prevents duplicate recurrence", () =>
  setup(async ({ call, persistence }) => {
    const args = {
      requestId: "stable",
      data: {
        title: "Walk",
        scheduledDate: "2026-10-01",
        repeat: { days: 1, missed: "skip" },
      },
    };
    const x = await call("task_create", args);
    assert.equal((await call("task_create", args)).id, x.id);
    await assert.rejects(
      call("task_create", { ...args, data: { title: "Other" } }),
      { code: "conflict" },
    );
    const a = { id: x.id, revision: 1, requestId: "complete-stable" };
    const done = await call("task_complete", a);
    await call("task_complete", a);
    const p = await call("task_list");
    assert.equal(p.total, 2);
    assert.equal(
      p.items.find((y) => y.id === done.nextOccurrenceId).scheduledDate,
      "2026-10-18",
    );
    const h = await createVector({ persistence });
    assert.equal((await h["vector.task_create"](args, owner)).id, x.id);
    await assert.rejects(call("task_reopen", { id: x.id, revision: 2 }), {
      code: "conflict",
    });
  }));
test("scoped agent can create tasks but cannot read journal, delete or change settings", () =>
  setup(async ({ call }) => {
    const agent = {
      kind: "token",
      name: "agent",
      scopes: ["call:vector.task_create"],
    };
    await call("task_create", { data: { title: "Allowed" } }, agent);
    for (const op of [
      "entry_list",
      "settings_update",
      "task_delete",
      "summary",
      "export",
    ])
      await assert.rejects(call(op, {}, agent), { code: "forbidden" });
  }));
test("journal time zones and sleep crossing midnight", () =>
  setup(async ({ call }) => {
    const x = await call("entry_create", {
      data: {
        text: "Sleep",
        kind: "sleep",
        at: "2026-10-16T19:00:00Z",
        endAt: "2026-10-17T03:00:00Z",
        timezone: "Asia/Yekaterinburg",
      },
    });
    assert.equal(x.date, "2026-10-17");
    assert.equal(localDate(x.at, x.timezone), "2026-10-17");
    await assert.rejects(
      call("entry_update", {
        id: x.id,
        revision: 1,
        data: { endAt: "2026-10-15T03:00:00Z" },
      }),
      { code: "bad_request" },
    );
    await assert.rejects(
      call("entry_create", { data: { text: "bad", date: "2026-02-30" } }),
      { code: "bad_request" },
    );
  }));
test("custom practice logs once and missing days are unknown, not failures", () =>
  setup(async ({ call }) => {
    const p = await call("practice_create", {
      data: { title: "English", kind: "custom" },
    });
    await call("practice_log", {
      id: p.id,
      data: { value: 15, unit: "min" },
      requestId: "log-once",
    });
    await call("practice_log", {
      id: p.id,
      data: { value: 15, unit: "min" },
      requestId: "log-once",
    });
    const r = await call("summary", { from: "2026-10-04", to: "2026-10-17" });
    assert.equal(r.practiceLogs, 1);
    assert.equal(r.unknownDays, 13);
  }));
test("serialized writes reject stale revisions and failed saves never report success", () =>
  setup(async ({ call }) => {
    const x = await call("task_create", { data: { title: "A" } });
    const r = await Promise.allSettled([
      call("task_update", { id: x.id, revision: 1, data: { title: "B" } }),
      call("task_update", { id: x.id, revision: 1, data: { title: "C" } }),
    ]);
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
    const h = await createVector({
      persistence: {
        load: async () => null,
        save: async () => {
          throw Error("disk full");
        },
      },
    });
    await assert.rejects(
      h["vector.task_create"]({ data: { title: "A" }, requestId: "a" }, owner),
    );
    assert.equal((await h["vector.task_list"]({}, owner)).total, 0);
  }));
test("deletion tombstones cannot be resurrected by a stale client", () =>
  setup(async ({ call }) => {
    const x = await call("entry_create", { data: { text: "private" } });
    await call("entry_delete", { id: x.id, revision: 1 });
    assert.equal((await call("entry_list")).total, 0);
    await assert.rejects(
      call("entry_update", {
        id: x.id,
        revision: 1,
        data: { text: "resurrect" },
      }),
      { code: "not_found" },
    );
  }));
test("pagination preserves a response below bridge limits and validates size", () =>
  setup(async ({ call }) => {
    for (let i = 0; i < 25; i++)
      await call("entry_create", {
        data: { text: String(i).padEnd(12000, "x") },
      });
    let cursor,
      ids = [];
    do {
      const p = await call("entry_list", {
        limit: 20,
        ...(cursor ? { cursor } : {}),
      });
      assert(Buffer.byteLength(JSON.stringify(p)) < 64000);
      ids.push(...p.items.map((x) => x.id));
      cursor = p.nextCursor;
    } while (cursor);
    assert.equal(new Set(ids).size, 25);
    await assert.rejects(call("task_list", { limit: 100 }), {
      code: "bad_request",
    });
    await assert.rejects(
      call("task_create", { data: { title: "x", unknown: true } }),
      { code: "bad_request" },
    );
  }));
test("cyclic parent links and direct completion bypass are rejected", () =>
  setup(async ({ call }) => {
    const a = await call("task_create", { data: { title: "A" } });
    const b = await call("task_create", {
      data: { title: "B", parentId: a.id },
    });
    await assert.rejects(
      call("task_update", { id: a.id, revision: 1, data: { parentId: b.id } }),
      { code: "bad_request" },
    );
    await assert.rejects(
      call("task_update", { id: a.id, revision: 1, data: { status: "done" } }),
      { code: "bad_request" },
    );
  }));
test("invalid or future state is not silently overwritten", () =>
  setup(async ({ persistence, dir }) => {
    await writeFile(join(dir, "vector.json"), "{");
    await assert.rejects(createVector({ persistence }));
    await writeFile(
      join(dir, "vector.json"),
      JSON.stringify({ version: 99, entities: {} }),
    );
    await assert.rejects(createVector({ persistence }), {
      code: "incompatible",
    });
  }));

test("completion-date filtering does not confuse scheduled and actual days", () =>
  setup(async ({ call }) => {
    const x = await call("task_create", {
      data: { title: "Earlier plan", scheduledDate: "2026-10-01" },
    });
    await call("task_complete", { id: x.id, revision: 1 });
    assert.equal(
      (await call("task_list", { status: "done", completedDate: "2026-10-17" }))
        .total,
      1,
    );
    assert.equal((await call("task_list", { date: "2026-10-17" })).total, 0);
  }));
test("oversized entities and empty timezone settings fail before persistence", () =>
  setup(async ({ call }) => {
    await assert.rejects(
      call("task_create", {
        data: {
          title: "Too large",
          description: "漢".repeat(12000),
          checklist: [
            { id: "a", text: "漢".repeat(500), done: false },
            { id: "b", text: "漢".repeat(500), done: false },
          ],
        },
      }),
      { code: "bad_request" },
    );
    await assert.rejects(
      call("settings_update", { revision: 1, data: { timezone: "" } }),
      { code: "bad_request" },
    );
    assert.equal((await call("task_list")).total, 0);
  }));
