export const entities = [
  "task",
  "entry",
  "practice",
  "project",
  "direction",
  "skill",
  "evidence",
  "experiment",
];
const str = { type: "string" },
  num = { type: "number" },
  obj = { type: "object" };
export const specs = [
  { name: "status", params: {} },
  ...entities.flatMap((type) => [
    {
      name: type + "_list",
      params: {
        limit: num,
        cursor: str,
        date: str,
        completedDate: str,
        status: str,
        projectId: str,
        practiceId: str,
        search: str,
      },
    },
    {
      name: type + "_create",
      params: {
        data: { ...obj, required: true },
        requestId: { ...str, required: true },
      },
    },
    {
      name: type + "_update",
      params: {
        id: { ...str, required: true },
        revision: { ...num, required: true },
        data: { ...obj, required: true },
        requestId: { ...str, required: true },
      },
    },
    {
      name: type + "_delete",
      params: {
        id: { ...str, required: true },
        revision: { ...num, required: true },
        requestId: { ...str, required: true },
      },
    },
  ]),
  ...["task_complete", "task_reopen"].map((name) => ({
    name,
    params: {
      id: { ...str, required: true },
      revision: { ...num, required: true },
      requestId: { ...str, required: true },
    },
  })),
  {
    name: "practice_log",
    params: {
      id: { ...str, required: true },
      data: { ...obj, required: true },
      requestId: { ...str, required: true },
    },
  },
  {
    name: "calendar",
    params: {
      from: { ...str, required: true },
      to: { ...str, required: true },
    },
  },
  {
    name: "summary",
    params: {
      from: { ...str, required: true },
      to: { ...str, required: true },
    },
  },
  { name: "settings_get", params: {} },
  {
    name: "settings_update",
    params: {
      revision: { ...num, required: true },
      data: { ...obj, required: true },
      requestId: { ...str, required: true },
    },
  },
  {
    name: "export",
    params: { entity: { ...str, required: true }, cursor: str, limit: num },
  },
];
export const capabilities = specs.map((s) => "vector." + s.name);
export const surfaces = [
  ["today", "Today", "Сегодня", "sun"],
  ["capture", "Quick capture", "Быстрая запись", "plus-circle"],
  ["tasks", "Tasks", "Задачи", "check-square"],
  ["journal", "Journal", "Дневник", "notebook"],
  ["calendar", "Calendar", "Календарь", "calendar-blank"],
  ["practices", "Practices", "Практики", "plant"],
  ["projects", "Projects", "Проекты", "stack"],
  ["skills", "Skills", "Навыки", "graduation-cap"],
  ["review", "Review", "Обзор", "compass"],
].map(([id, en, ru, icon]) => ({
  id,
  name: { en, ru },
  icon,
  kind: "widget",
  minWidth: 280,
  minHeight: 240,
  instance: "shared",
}));
export const manifest = {
  id: "vector",
  version: "0.1.0",
  description: "Self-directed tasks, journal, calendar and practices",
  capabilities: specs.map((s) => ({
    ...s,
    description: "Vector " + s.name.replaceAll("_", " "),
    admin: false,
  })),
  metadata: {
    ui: {
      id: "dev.delta.vector",
      name: "Delta Vector",
      version: "0.1.0",
      contract: "^1.5.0",
      publisher: "Delta",
      description: "Tasks, journal and practices without streak pressure.",
      icon: "compass",
      category: "productivity",
      runtime: {
        targets: ["desktop", "vps", "container"],
        execution: "process",
        minAgent: "0.4.3",
      },
      dependencies: [
        {
          kind: "core",
          id: "core",
          version: ">=0.4.3, <0.5.0",
          required: true,
        },
        {
          kind: "plugin",
          id: "dev.delta.db",
          version: ">=0.4.0",
          required: true,
        },
      ],
      permissions: [
        {
          scope: "register:vector",
          reason: "Register the Vector service",
          optional: false,
        },
        ...["document_get", "document_put"].map((x) => ({
          scope: "call:storage." + x,
          reason: "Persist service-owned Vector documents",
          optional: false,
        })),
      ],
      metrics: [],
      capabilities: ["actions", "status.read"],
      actions: [{ id: "status", label: "Status" }],
      localizations: {
        ru: {
          name: "Delta Vector",
          description: "Задачи, дневник и практики без давления серий.",
        },
      },
    },
  },
};
export const appManifest = {
  id: "dev.delta.vector",
  name: "Delta Vector",
  version: "0.1.0",
  entry: "index.html",
  runtime: {
    execution: "web",
    platforms: ["android", "windows", "linux", "macos", "ios", "web"],
    architectures: ["any"],
  },
  permissions: ["storage.local"],
  grants: [],
  ui: { version: 1, surfaces },
};
