import { randomUUID, createHash } from "node:crypto";
import { DeltaError, allowed } from "./delta-sdk.mjs";
import { workspaceHandlers, syncNativeWorkspace } from './workspace.mjs';
import { entities, specs } from "./contract.mjs";
const fail = (code, message) => {
  throw new DeltaError(code, message);
};
const plain = (v) =>
  v !== null &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.getPrototypeOf(v) === Object.prototype;
const text = (v, n = 240) => typeof v === "string" && v.length <= n;
const date = (v) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !isNaN(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
const instant = (v) =>
  typeof v === "string" &&
  v.length <= 40 &&
  /T.*(?:Z|[+-]\d\d:\d\d)$/.test(v) &&
  !isNaN(Date.parse(v));
const id = (v) => typeof v === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(v);
const own = (o, k) => Object.hasOwn(o, k);
export function localDate(at, timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(at));
}
export function nextDate(day, days) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const fieldSets = {
  task: [
    "title",
    "description",
    "status",
    "scheduledDate",
    "deadline",
    "estimateMinutes",
    "projectId",
    "directionId",
    "practiceId",
    "checklist",
    "repeat",
    "parentId",
  ],
  entry: [
    "text",
    "kind",
    "date",
    "at",
    "endAt",
    "timezone",
    "value",
    "unit",
    "practiceId",
    "projectId",
    "skillId",
    "taskId",
    "assistance",
    "source",
  ],
  practice: [
    "title",
    "description",
    "kind",
    "unit",
    "target",
    "weekdays",
    "minimum",
    "active",
  ],
  project: ["title", "description", "status", "directionId", "nextStep"],
  direction: ["title", "description", "reason", "reviewDate", "status"],
  skill: ["title", "description", "projectId"],
  evidence: [
    "title",
    "text",
    "skillId",
    "projectId",
    "assistance",
    "date",
    "url",
  ],
  experiment: ["title", "description", "hypothesis", "from", "to", "status"],
};
function validate(type, data, partial = false) {
  if (
    !plain(data) ||
    Buffer.byteLength(JSON.stringify(data)) > 38000 ||
    Object.keys(data).some((k) => !fieldSets[type].includes(k))
  )
    fail("bad_request", "Unknown or invalid fields");
  if (!partial && type !== "entry" && !text(data.title, 240))
    fail("bad_request", "Title required");
  if (!partial && type !== "entry" && !data.title?.trim())
    fail("bad_request", "Title required");
  if (type === "entry" && !partial && !text(data.text, 12000))
    fail("bad_request", "Text required");
  for (const [k, v] of Object.entries(data)) {
    if (v === null) {
      if (["title", "text", "status", "kind", "source", "active"].includes(k))
        fail("bad_request", "Field cannot be cleared");
      continue;
    }
    if (
      [
        "title",
        "description",
        "text",
        "reason",
        "nextStep",
        "hypothesis",
        "minimum",
      ].includes(k) &&
      (!text(v, ["text", "description"].includes(k) ? 12000 : 1000) ||
        (k === "title" && !v.trim()))
    )
      fail("bad_request", "Invalid text");
    if (
      [
        "scheduledDate",
        "deadline",
        "date",
        "reviewDate",
        "from",
        "to",
      ].includes(k) &&
      !date(v)
    )
      fail("bad_request", "Invalid date");
    if (["at", "endAt"].includes(k) && !instant(v))
      fail("bad_request", "Invalid timestamp");
    if (k === "timezone") {
      if (!text(v, 80)) fail("bad_request", "Invalid timezone");
      try {
        new Intl.DateTimeFormat("en", { timeZone: v }).format();
      } catch {
        fail("bad_request", "Invalid timezone");
      }
    }
    if (k.endsWith("Id") && !id(v)) fail("bad_request", "Invalid reference");
    if (
      ["estimateMinutes", "value", "target"].includes(k) &&
      (!Number.isFinite(v) || Math.abs(v) > 1e7 || (k !== "value" && v < 0))
    )
      fail("bad_request", "Invalid number");
    if (
      k === "status" &&
      !(
        ["task"].includes(type)
          ? ["inbox", "planned", "doing", "done", "cancelled"]
          : ["active", "paused", "done", "cancelled"]
      ).includes(v)
    )
      fail("bad_request", "Invalid status");
    if (
      k === "kind" &&
      !(
        type === "entry"
          ? ["note", "sleep", "activity", "learning", "reflection", "practice"]
          : ["custom", "sleep", "activity", "learning"]
      ).includes(v)
    )
      fail("bad_request", "Invalid kind");
    if (
      k === "assistance" &&
      !["independent", "hint", "generated", "reproduced"].includes(v)
    )
      fail("bad_request", "Invalid assistance");
    if (["unit", "source"].includes(k) && (!text(v, 80) || !v.trim()))
      fail("bad_request", "Invalid label");
    if (k === "url") {
      try {
        if (!["https:", "http:"].includes(new URL(v).protocol)) throw Error();
      } catch {
        fail("bad_request", "Invalid URL");
      }
    }
    if (k === "active" && typeof v !== "boolean")
      fail("bad_request", "Invalid active flag");
    if (
      k === "weekdays" &&
      (!Array.isArray(v) ||
        v.length > 7 ||
        v.some((x) => !Number.isInteger(x) || x < 0 || x > 6))
    )
      fail("bad_request", "Invalid weekdays");
    if (
      k === "repeat" &&
      (!plain(v) ||
        Object.keys(v).some((k) => !["days", "missed"].includes(k)) ||
        !Number.isInteger(v.days) ||
        v.days < 1 ||
        v.days > 365 ||
        !["skip", "carry"].includes(v.missed))
    )
      fail("bad_request", "Invalid recurrence");
    if (
      k === "checklist" &&
      (!Array.isArray(v) ||
        v.length > 40 ||
        v.some(
          (x) =>
            !plain(x) ||
            Object.keys(x).some((k) => !["id", "text", "done"].includes(k)) ||
            !id(x.id) ||
            !text(x.text, 500) ||
            typeof x.done !== "boolean",
        ) ||
        new Set(v.map((x) => x.id)).size !== v.length)
    )
      fail("bad_request", "Invalid checklist");
  }
  if (
    type === "entry" &&
    data.endAt &&
    data.at &&
    Date.parse(data.endAt) < Date.parse(data.at)
  )
    fail("bad_request", "Interval ends before it starts");
  if (type === "experiment" && data.from && data.to && data.to < data.from)
    fail("bad_request", "Invalid experiment range");
}
export async function createLifeOS({
  persistence,
  now = () => new Date().toISOString(),
} = {}) {
  let state = (await persistence.load()) || {
    version: 1,
    revision: 0,
    settings: {
      revision: 1,
      timezone: "UTC",
      locale: "ru",
      activeProjectLimit: 0,
    },
    entities: Object.fromEntries(entities.map((e) => [e, {}])),
    requests: [],
  };
  if (
    state.version !== 1 ||
    !plain(state.entities) ||
    entities.some((t) => !plain(state.entities[t])) ||
    !plain(state.settings) ||
    !Array.isArray(state.requests) ||
    !Number.isInteger(state.revision)
  )
    fail("incompatible", "Unsupported data version");
  let tail = Promise.resolve();
  const readRows = (type) =>
    Object.values(state.entities[type]).filter((x) => !x.deletedAt);
  const find = (s, type, key) => {
    if (!id(key)) fail("bad_request", "Invalid id");
    const x = s.entities[type][key];
    if (!x || x.deletedAt) fail("not_found", "Item not found");
    return x;
  };
  const revision = (x, a) => {
    if (!Number.isInteger(a.revision) || x.revision !== a.revision)
      fail("conflict", "Item changed; reload before editing");
  };
  const references = (s, type, data) => {
    for (const [field, target] of Object.entries({
      projectId: "project",
      directionId: "direction",
      practiceId: "practice",
      skillId: "skill",
      taskId: "task",
      parentId: "task",
    }))
      if (data[field]) find(s, target, data[field]);
    if (type === "evidence" && !data.skillId)
      fail("bad_request", "Skill required");
  };
  const insert = (s, type, data, at) => {
    validate(type, data);
    if (type === "task" && data.status === "done")
      fail("bad_request", "Use task_complete");
    references(s, type, data);
    const x = {
      ...structuredClone(data),
      id: randomUUID(),
      revision: 1,
      createdAt: at,
      updatedAt: at,
    };
    if (type === "entry") {
      x.at ||= at;
      x.timezone ||= s.settings.timezone;
      x.date ||= localDate(x.at, x.timezone);
    }
    if (type === "task") x.status ||= "inbox";
    if (["project", "direction", "experiment"].includes(type))
      x.status ||= "active";
    if (type === "practice") x.active ??= true;
    s.entities[type][x.id] = x;
    return x;
  };
  const mutate = (op, args, caller, fn) => {
    if (!id(args.requestId))
      return Promise.reject(
        new DeltaError("bad_request", "requestId required"),
      );
    const principal = JSON.stringify([
      caller.kind,
      caller.peer_id || "",
      caller.name || "",
    ]);
    const hash = createHash("sha256")
      .update(JSON.stringify({ op, args }))
      .digest("hex");
    const work = tail.then(async () => {
      const prev = state.requests.find(
        (r) => r.id === args.requestId && r.principal === principal,
      );
      if (prev) {
        if (prev.hash !== hash) fail("conflict", "requestId already used");
        return structuredClone(prev.result);
      }
      const s = structuredClone(state),
        result = fn(s, now());
      syncNativeWorkspace(s,state,op,result,now());
      s.revision++;
      s.requests.push({ id: args.requestId, principal, hash, result });
      s.requests = s.requests.slice(-64);
      if (Buffer.byteLength(JSON.stringify(s)) > 900000)
        fail(
          "capacity",
          "LifeOS document limit reached; export and archive data",
        );
      await persistence.save(s);
      state = s;
      return structuredClone(result);
    });
    tail = work.catch(() => {});
    return work;
  };
  const page = (type, a = {}) => {
    if (
      a.limit !== undefined &&
      (!Number.isInteger(a.limit) || a.limit < 1 || a.limit > 20)
    )
      fail("bad_request", "limit must be 1–20");
    if (a.completedDate !== undefined && !date(a.completedDate))
      fail("bad_request", "Invalid completion date");
    if (a.date !== undefined && !date(a.date))
      fail("bad_request", "Invalid date");
    const offset = a.cursor === undefined ? 0 : Number(a.cursor);
    if (!Number.isSafeInteger(offset) || offset < 0)
      fail("bad_request", "Invalid cursor");
    const limit = a.limit || 20;
    let rows = readRows(type)
      .filter(
        (x) =>
          (!a.date ||
            (type === "task" ? x.scheduledDate : x.date) === a.date) &&
          (!a.completedDate ||
            (x.completedAt &&
              localDate(x.completedAt, state.settings.timezone) ===
                a.completedDate)) &&
          (!a.status || x.status === a.status) &&
          (!a.projectId || x.projectId === a.projectId) &&
          (!a.practiceId || x.practiceId === a.practiceId) &&
          (!a.search ||
            String(x.title || x.text)
              .toLowerCase()
              .includes(String(a.search).toLowerCase())),
      )
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
      );
    const total = rows.length;
    let out = [],
      bytes = 0;
    for (const x of rows.slice(offset, offset + limit)) {
      const n = Buffer.byteLength(JSON.stringify(x));
      if (bytes + n > 44000) break;
      out.push(x);
      bytes += n;
    }
    return {
      items: structuredClone(out),
      total,
      nextCursor:
        offset + out.length < total ? String(offset + out.length) : null,
      revision: state.revision,
    };
  };
  const h = {};
  for (const type of entities) {
    h["lifeos." + type + "_list"] = (a) => page(type, a);
    h["lifeos." + type + "_create"] = (a, c) =>
      mutate(type + "_create", a, c, (s, at) => insert(s, type, a.data, at));
    h["lifeos." + type + "_update"] = (a, c) =>
      mutate(type + "_update", a, c, (s, at) => {
        const x = find(s, type, a.id);
        revision(x, a);
        validate(type, a.data, true);
        if (
          type === "task" &&
          a.data.status &&
          a.data.status !== x.status &&
          (a.data.status === "done" || x.status === "done")
        )
          fail("bad_request", "Use task_complete or task_reopen");
        const merged = { ...x, ...a.data };
        validate(
          type,
          Object.fromEntries(
            Object.entries(merged).filter(([k]) => fieldSets[type].includes(k)),
          ),
        );
        references(s, type, merged);
        if (type === "task" && a.data.parentId) {
          let pid = a.data.parentId;
          const seen = new Set([a.id]);
          while (pid) {
            if (seen.has(pid)) fail("bad_request", "Cyclic task parents");
            seen.add(pid);
            pid = find(s, "task", pid).parentId;
          }
        }
        Object.assign(x, a.data, { revision: x.revision + 1, updatedAt: at });
        return x;
      });
    h["lifeos." + type + "_delete"] = (a, c) =>
      mutate(type + "_delete", a, c, (s, at) => {
        const x = find(s, type, a.id);
        revision(x, a);
        s.entities[type][a.id] = {
          id: a.id,
          revision: x.revision + 1,
          deletedAt: at,
        };
        return { id: a.id, deleted: true };
      });
  }
  for (const done of [true, false])
    h["lifeos.task_" + (done ? "complete" : "reopen")] = (a, c) =>
      mutate(done ? "task_complete" : "task_reopen", a, c, (s, at) => {
        const x = find(s, "task", a.id);
        revision(x, a);
        if ((x.status === "done") === done) return x;
        if (
          !done &&
          x.nextOccurrenceId &&
          !s.entities.task[x.nextOccurrenceId]?.deletedAt
        )
          fail(
            "conflict",
            "Remove the generated next occurrence before reopening",
          );
        x.status = done ? "done" : "inbox";
        x.completedAt = done ? at : null;
        x.revision++;
        x.updatedAt = at;
        if (done && x.repeat) {
          let day = nextDate(
            x.scheduledDate || localDate(at, s.settings.timezone),
            x.repeat.days,
          );
          if (x.repeat.missed === "skip")
            while (day <= localDate(at, s.settings.timezone))
              day = nextDate(day, x.repeat.days);
          const data = Object.fromEntries(
            Object.entries(x).filter(([k]) => fieldSets.task.includes(k)),
          );
          data.status = "planned";
          data.scheduledDate = day;
          data.checklist = (data.checklist || []).map((v) => ({
            ...v,
            done: false,
          }));
          x.nextOccurrenceId = insert(s, "task", data, at).id;
        }
        return x;
      });
  h["lifeos.practice_log"] = (a, c) =>
    mutate("practice_log", a, c, (s, at) => {
      const p = find(s, "practice", a.id);
      return insert(
        s,
        "entry",
        {
          text: p.title,
          kind: p.kind === "custom" ? "practice" : p.kind || "practice",
          ...a.data,
          practiceId: p.id,
          source: "manual",
        },
        at,
      );
    });
  const range = (a) => {
    if (
      !date(a.from) ||
      !date(a.to) ||
      a.to < a.from ||
      (Date.parse(a.to) - Date.parse(a.from)) / 864e5 > 366
    )
      fail("bad_request", "Range must be 0–366 days");
  };
  h["lifeos.calendar"] = (a) => {
    range(a);
    const days = {};
    const add = (day, key) => {
      if (day && day >= a.from && day <= a.to) {
        days[day] ||= { tasks: 0, completed: 0, entries: 0 };
        days[day][key]++;
      }
    };
    for (const x of readRows("task")) {
      add(x.scheduledDate, "tasks");
      if (x.completedAt)
        add(localDate(x.completedAt, state.settings.timezone), "completed");
    }
    for (const x of readRows("entry")) add(x.date, "entries");
    return { days };
  };
  h["lifeos.summary"] = (a) => {
    range(a);
    const entries = readRows("entry").filter(
      (x) => x.date >= a.from && x.date <= a.to,
    );
    return {
      from: a.from,
      to: a.to,
      completed: readRows("task").filter(
        (x) =>
          x.completedAt &&
          localDate(x.completedAt, state.settings.timezone) >= a.from &&
          localDate(x.completedAt, state.settings.timezone) <= a.to,
      ).length,
      recordedDays: new Set(entries.map((x) => x.date)).size,
      entries: entries.length,
      practiceLogs: entries.filter((x) => x.practiceId).length,
      activeProjects: readRows("project").filter((x) => x.status === "active")
        .length,
      projectLimit: state.settings.activeProjectLimit,
      unknownDays:
        Math.round((Date.parse(a.to) - Date.parse(a.from)) / 864e5) +
        1 -
        new Set(entries.map((x) => x.date)).size,
    };
  };
  h["lifeos.status"] = () => ({
    version: "0.3.2",
    revision: state.revision,
    storage: "connected",
    counts: Object.fromEntries(entities.map((e) => [e, readRows(e).length])),
  });
  h["lifeos.settings_get"] = () => structuredClone(state.settings);
  h["lifeos.settings_update"] = (a, c) =>
    mutate("settings_update", a, c, (s) => {
      revision(s.settings, a);
      if (
        !plain(a.data) ||
        Object.keys(a.data).some(
          (k) => !["timezone", "locale", "activeProjectLimit"].includes(k),
        )
      )
        fail("bad_request", "Invalid settings");
      if (own(a.data, "timezone")) {
        if (!text(a.data.timezone, 80) || !a.data.timezone)
          fail("bad_request", "Invalid timezone");
        try {
          new Intl.DateTimeFormat("en", { timeZone: a.data.timezone }).format();
        } catch {
          fail("bad_request", "Invalid timezone");
        }
      }
      if (own(a.data, "locale") && !["en", "ru"].includes(a.data.locale))
        fail("bad_request", "Invalid locale");
      if (
        own(a.data, "activeProjectLimit") &&
        (!Number.isInteger(a.data.activeProjectLimit) ||
          a.data.activeProjectLimit < 0 ||
          a.data.activeProjectLimit > 10000)
      )
        fail("bad_request", "Invalid project limit");
      Object.assign(s.settings, a.data, { revision: s.settings.revision + 1 });
      return s.settings;
    });
  h["lifeos.export"] = (a) => {
    if (!entities.includes(a.entity)) fail("bad_request", "Invalid entity");
    return {
      ...page(a.entity, a),
      format: "delta-lifeos-v1",
      entity: a.entity,
    };
  };
  Object.assign(h,workspaceHandlers({getState:()=>state,mutate}));
  return Object.fromEntries(
    specs.map((spec) => {
      const cap = "lifeos." + spec.name;
      return [
        cap,
        async (a = {}, caller = {}) => {
          if (!allowed(caller, cap))
            fail("forbidden", "Capability not granted");
          if (!plain(a) || Buffer.byteLength(JSON.stringify(a)) > 56000)
            fail("bad_request", "Invalid request");
          return h[cap](a, caller);
        },
      ];
    }),
  );
}
