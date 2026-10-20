import {randomId} from '@delta/ui/sdk/random';
import {
  connectPlugin,
  applyThemeTokens,
  type AppContext,
} from "@delta/ui/sdk/client";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/800.css";
import "@fontsource/onest/400.css";
import "@fontsource/onest/700.css";
import "@fontsource/golos-text/400.css";
import "@fontsource/golos-text/600.css";
import "@fontsource/literata/600-italic.css";
import "@fontsource/jetbrains-mono/400.css";
import { icons, icon } from "./icons";
import { styledControls } from "@delta/ui/sdk/controls";
import "@delta/ui/sdk/styles.css";
import { words, type Key } from "./i18n";
import "./legacy.css";
type Item = { id: string; revision: number; [k: string]: any };
type Page = { items: Item[]; total: number; nextCursor: string | null };
const params = new URLSearchParams(location.search),
  root = document.querySelector<HTMLDivElement>("#vector-app")!;
styledControls();
let lang: "en" | "ru" = params.get("lang") === "en" ? "en" : "ru";
let surface = params.get("surface") || "",
  view = surface || "today",
  filter = "all",
  selectedDate = "",
  month = "";
let settings: Item = {
  id: "settings",
  revision: 1,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  activeProjectLimit: 0,
};
let host: Awaited<ReturnType<typeof connectPlugin>> | undefined,
  busy = false,
  online = false,
  notice = "",
  summary: any = {},
  calendar: any = {},
  pages: Record<string, Page> = {};
let loadSeq = 0;
let taskSearch = "",
  journalDate = "";

function query(type: string): Record<string, string> {
  if (type === "task") {
    if (view === "journal")
      return {
        status: "done",
        ...(journalDate ? { completedDate: journalDate } : {}),
      };
    if (view === "calendar") return { date: selectedDate };
    if (view === "today") return { date: today() };
    if (view === "tasks")
      return {
        ...(filter === "today"
          ? { date: today() }
          : ["inbox", "done"].includes(filter)
            ? { status: filter }
            : {}),
        ...(taskSearch ? { search: taskSearch } : {}),
      };
  }
  if (type === "entry") {
    if (view === "calendar") return { date: selectedDate };
    if (view === "journal" && journalDate) return { date: journalDate };
  }
  return {};
}
const t = (k: string) => words[lang][k as Key] || k;
const e = (v: any) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: settings.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const requestId = () => randomId();
const pending = new Map<string, string>();
async function mutation(op: string, args: any) {
  const key = JSON.stringify({ op, args });
  const rid = pending.get(key) || requestId();
  pending.set(key, rid);
  const result = await call(op, { ...args, requestId: rid });
  pending.delete(key);
  return result;
}
const rows = (type: string) => pages[type]?.items || [];
function readDraft() {
  try {
    return localStorage.getItem("delta.lifeos.draft") || "";
  } catch {
    return "";
  }
}
let draft = readDraft();
let settingsDirty = false;
root.addEventListener("input", (ev) => {
  ++loadSeq;
  if ((ev.target as HTMLElement).closest("#settings-form"))
    settingsDirty = true;
});
root.addEventListener("change", (ev) => {
  ++loadSeq;
  if ((ev.target as HTMLElement).closest("#settings-form"))
    settingsDirty = true;
});
const input = (
  name: string,
  label: string,
  value: any = "",
  type = "text",
  extra = "",
) =>
  `<label>${e(t(label))}<input name="${name}" type="${type}" value="${e(value)}" ${extra}></label>`;
const area = (name: string, label: string, value: any = "", extra = "") =>
  `<label>${e(t(label))}<textarea name="${name}" ${extra}>${e(value)}</textarea></label>`;
const select = (
  name: string,
  label: string,
  options: string[],
  value = "",
  labels = true,
) =>
  `<label>${e(t(label))}<select name="${name}">${options.map((x) => `<option value="${e(x)}" ${x === value ? "selected" : ""}>${e(labels ? t(x) : x)}</option>`).join("")}</select></label>`;
const projectSelect = (value = "") =>
  `<label>${t("project")}<select name="projectId"><option value="">${t("none")}</option>${rows(
    "project",
  )
    .map(
      (x) =>
        `<option value="${x.id}" ${value === x.id ? "selected" : ""}>${e(x.title)}</option>`,
    )
    .join("")}</select></label>`;
function showError(err: any) {
  notice =
    err?.code === "conflict" || err?.message === "conflict"
      ? t("conflict")
      : t("error");
  const box = document.querySelector("#notice");
  if (box) {
    box.textContent = notice;
    box.removeAttribute("hidden");
  }
  console.warn("LifeOS operation failed", err?.code || "operation_failed");
}
async function call(op: string, args: any = {}) {
  if (!host) throw Error("unavailable");
  return (await host.call("lifeos." + op, args)) as any;
}
async function all(type: string) {
  let items: Item[] = [],
    cursor: string | undefined;
  do {
    const p = await call(type + "_list", {
      limit: 20,
      ...(cursor ? { cursor } : {}),
    });
    items.push(...p.items);
    cursor = p.nextCursor || undefined;
    if (items.length > 5000) throw Error("capacity");
  } while (cursor);
  return items;
}
function range() {
  const d = new Date(today() + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 13);
  return { from: d.toISOString().slice(0, 10), to: today() };
}
async function load() {
  const seq = ++loadSeq;
  const freshSettings = await call("settings_get");
  if (seq !== loadSeq) return;
  settings = freshSettings;
  month ||= today().slice(0, 7);
  selectedDate ||= today();
  const types = [
    "task",
    "entry",
    "practice",
    "project",
    "direction",
    "skill",
    "evidence",
    "experiment",
  ];
  const results: Record<string, Page> = {};
  for (let i = 0; i < types.length; i += 3) {
    await Promise.all(
      types.slice(i, i + 3).map(async (type) => {
        results[type] = await call(type + "_list", {
          limit: 20,
          ...query(type),
        });
      }),
    );
  }
  if (
    seq !== loadSeq ||
    settingsDirty ||
    root.querySelector<HTMLDialogElement>("dialog")?.open
  )
    return;
  settings = freshSettings;
  pages = results;
  month ||= today().slice(0, 7);
  selectedDate ||= today();
  summary = await call("summary", range());
  calendar = await call("calendar", {
    from: month + "-01",
    to:
      month +
      "-" +
      new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate(),
  });
  if (
    seq !== loadSeq ||
    settingsDirty ||
    root.querySelector<HTMLDialogElement>("dialog")?.open
  )
    return;
  online = true;
  document.documentElement.dataset.lifeosConnected = "true";
  notice = "";
  render();
}
async function perform(op: string, args: any, after?: () => void) {
  if (busy) return;
  busy = true;
  document
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach((x) => (x.disabled = true));
  try {
    await mutation(op, args);
    after?.();
    await load();
  } catch (err) {
    showError(err);
  } finally {
    busy = false;
    document
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach((x) => (x.disabled = false));
  }
}
function taskRow(x: Item) {
  const done = x.status === "done";
  return `<article class="task-row"><button class="check ${done ? "checked" : ""}" data-complete="${x.id}" aria-label="${t(done ? "reopen" : "complete")}: ${e(x.title)}" aria-pressed="${done}">${done ? icon("check") : ""}</button><button class="task-body" data-edit="task:${x.id}"><span class="task-title ${done ? "done" : ""}">${e(x.title)}</span><span class="meta">${[x.scheduledDate, x.deadline ? `${t("deadline")}: ${x.deadline}` : "", x.estimateMinutes ? `${x.estimateMinutes} min` : "", x.repeat ? `${t("repeatLabel")}: ${x.repeat.days} ${t("days")}` : "", x.projectId ? rows("project").find((p) => p.id === x.projectId)?.title : ""].filter(Boolean).map(e).join(" · ") || e(t(x.status))}</span></button><button class="icon-btn" data-edit="task:${x.id}" aria-label="${t("edit")}">${icon("dots-three")}</button></article>`;
}
function taskSection(items: Item[], heading = "") {
  return `${heading ? `<div class="section-heading"><h2>${e(heading)}</h2><span class="counter">${items.length}</span></div>` : ""}${items.length ? items.map(taskRow).join("") : `<div class="empty"><span>${icon("circle")}</span><p>${t(view === "today" ? "todayEmpty" : "empty")}</p></div>`}`;
}
function capture() {
  return `<form id="capture-form" class="capture-form"><label class="sr-only" for="capture-text">${t("text")}</label><textarea id="capture-text" name="text" maxlength="12000" placeholder="${t(view === "journal" ? "journalHint" : "captureHint")}" required>${e(draft)}</textarea><div class="form-foot"><span id="draft-note" class="meta">${t("draft")}</span><button class="primary" type="submit">${icon("arrow-up-right")} ${t("record")}</button></div></form>`;
}
function more(type: string) {
  return pages[type]?.nextCursor
    ? `<button class="load-more" data-more="${type}">${t("more")} · ${rows(type).length} / ${pages[type].total}</button>`
    : "";
}
function entryRow(x: Item) {
  return `<article class="entry"><div class="entry-head"><span class="badge">${e(t(x.kind || "note"))}</span><time>${e(x.date)} · ${e(new Date(x.at).toLocaleTimeString(lang, { timeZone: x.timezone || settings.timezone, hour: "2-digit", minute: "2-digit" }))}</time><button class="icon-btn" data-edit="entry:${x.id}" aria-label="${t("edit")}">${icon("dots-three")}</button></div><p>${e(x.text)}</p>${x.value !== undefined && x.value !== null ? `<span class="meta">${e(x.value)} ${e(x.unit || "")}</span>` : ""}${x.at && x.endAt ? `<span class="meta">${t("duration")}: ${Math.round((Date.parse(x.endAt) - Date.parse(x.at)) / 60000)}</span>` : ""}${x.source && x.source !== "manual" ? `<span class="meta">${t("source")}: ${e(x.source)}</span>` : ""}</article>`;
}
function cards(type: string) {
  return (
    rows(type)
      .map(
        (x) =>
          `<article class="entity-card"><div class="section-heading"><h2>${e(x.title)}</h2><button class="icon-btn" data-edit="${type}:${x.id}" aria-label="${t("edit")}">${icon("dots-three")}</button></div><p>${e(x.description || x.minimum || x.nextStep || "")}</p><div class="form-foot"><span class="badge">${e(type === "practice" ? t(x.kind || "custom") : type === "skill" ? t("evidence") : t(x.status || "active"))}</span>${type === "practice" ? `<button data-log="${x.id}" ${x.active === false ? "disabled" : ""}>${icon("plus")} ${t("log")}</button>` : type === "skill" ? `<button data-evidence="${x.id}">${icon("plus")} ${t("result")}</button>` : ""}</div>${
            type === "skill"
              ? rows("evidence")
                  .filter((v) => v.skillId === x.id)
                  .map(
                    (v) =>
                      `<button class="evidence-row" data-edit="evidence:${v.id}">${e(v.title)} <span class="meta">${e(t(v.assistance || "independent"))}</span></button>`,
                  )
                  .join("")
              : ""
          }</article>`,
      )
      .join("") || `<p class="empty">${t("empty")}</p>`
  );
}
function calendarView() {
  const start = new Date(month + "-01T12:00:00Z"),
    offset = (start.getUTCDay() + 6) % 7,
    last = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5)),
      0,
    ).getDate();
  const week =
    lang === "ru"
      ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return `<section class="panel"><div class="section-heading"><button data-month="-1" aria-label="${t("prev")}">${icon("arrow-left")}</button><h2>${new Intl.DateTimeFormat(lang, { month: "long", year: "numeric", timeZone: "UTC" }).format(start)}</h2><button data-month="1" aria-label="${t("nextMonth")}">${icon("arrow-right")}</button></div><div class="calendar-grid">${week.map((x) => `<span class="weekday">${x}</span>`).join("")}${"<span></span>".repeat(offset)}${Array.from(
    { length: last },
    (_, i) => {
      const d = month + "-" + String(i + 1).padStart(2, "0"),
        counts = calendar.days?.[d];
      return `<button class="day ${d === selectedDate ? "selected" : ""} ${d === today() ? "current" : ""}" data-day="${d}" aria-pressed="${d === selectedDate}"><span>${i + 1}</span>${counts ? `<small>${counts.tasks ? icon("check-square") + " " + counts.tasks : ""} ${counts.entries ? icon("notebook") + " " + counts.entries : ""}</small>` : ""}</button>`;
    },
  ).join(
    "",
  )}</div><p class="meta calendar-legend">${icon("check-square")} ${t("scheduled")} ${icon("notebook")} ${t("observed")}</p></section><section class="panel"><div class="section-heading"><h2>${e(selectedDate)}</h2><button data-new="task" data-date="${selectedDate}">${icon("plus")} ${t("task")}</button></div>${taskSection(rows("task").filter((x) => x.scheduledDate === selectedDate))}${more("task")}${rows(
    "entry",
  )
    .filter((x) => x.date === selectedDate)
    .map(entryRow)
    .join(
      "",
    )}${more("entry")}<button id="load-day">${t("refresh")}</button></section>`;
}
function body() {
  switch (view) {
    case "capture":
      return capture();
    case "today":
      return `<div class="daily-heading page-head"><div><span class="label">${new Intl.DateTimeFormat(lang, { weekday: "long", day: "numeric", month: "long", timeZone: settings.timezone }).format(new Date())}</span><h1 class="page-title">${t("today")}</h1></div></div><div class="two-col"><section class="panel"><div class="section-heading"><h2>${t("plan")}</h2><button data-new="task" data-date="${today()}">${icon("plus")} ${t("task")}</button></div>${taskSection(rows("task").filter((x) => x.scheduledDate === today() && !["done", "cancelled"].includes(x.status)))}${more("task")}</section><section class="panel"><div class="section-heading"><h2>${t("capture")}</h2><span class="quiet-icon">${icon("notebook")}</span></div>${capture()}</section></div><section class="panel"><div class="section-heading"><h2>${t("practices")}</h2><button data-new="practice" aria-label="${t("newPractice")}">${icon("plus")}</button></div><div class="card-grid">${cards("practice")}</div>${more("practice")}</section>`;
    case "tasks": {
      let a = rows("task");
      a = a.filter((x) =>
        filter === "all" || filter === "today"
          ? filter === "all" || x.scheduledDate === today()
          : filter === "next"
            ? ["planned", "doing"].includes(x.status)
            : x.status === filter,
      );
      return `<div class="toolbar"><div class="filters seg sans" role="group" aria-label="${t("tasks")}">${["all", "inbox", "today", "next", "done"].map((x) => `<button data-filter="${x}" aria-pressed="${filter === x}">${t(x)}</button>`).join("")}</div><button class="primary" data-new="task">${icon("plus")} ${t("newTask")}</button><label class="search-field">${t("search")}<input id="task-search" type="search" value="${e(taskSearch)}" maxlength="200"></label></div><section class="panel">${taskSection(a)}${more("task")}</section>`;
    }
    case "journal":
      return `<section class="panel">${capture()}<div class="toolbar"><button data-new="entry">${icon("plus")} ${t("add")}</button><label>${t("date")}<input id="journal-date" type="date" value="${e(journalDate)}"></label></div></section><section class="panel">${taskSection(
        rows("task").filter((x) => x.status === "done"),
        t("completed"),
      )}${more("task")}${rows("entry").map(entryRow).join("") || `<p class="empty">${t("empty")}</p>`}${more("entry")}</section>`;
    case "calendar":
      return calendarView();
    case "practices":
    case "projects":
    case "skills": {
      const type =
        view === "practices"
          ? "practice"
          : view === "projects"
            ? "project"
            : "skill";
      return `<div class="toolbar"><p class="meta">${t(type === "practice" ? "minimum" : type === "project" ? "nextStep" : "evidence")}</p><button class="primary" data-new="${type}">${icon("plus")} ${t(type === "practice" ? "newPractice" : type === "project" ? "newProject" : "newSkill")}</button></div>${view === "projects" && settings.activeProjectLimit > 0 && summary.activeProjects > settings.activeProjectLimit ? `<p class="notice">${t("projectWarning")}</p>` : ""}<div class="card-grid">${cards(type)}</div>${more(type)}${type === "skill" ? more("evidence") : ""}`;
    }
    case "review":
      return `<section class="panel"><span class="eyebrow">${e(summary.from)} — ${e(summary.to)}</span><h2>${t("review")}</h2><div class="stats">${[
        ["completed", "completed"],
        ["recordedDays", "recordedDays"],
        ["practiceLogs", "practiceLogs"],
        ["unknownDays", "unknown"],
      ]
        .map(
          ([key, label]) =>
            `<div><strong>${summary[key] ?? 0}</strong><span>${t(label)}</span></div>`,
        )
        .join(
          "",
        )}</div></section><section class="panel"><h2>${t("direction")}</h2><button data-new="direction">${icon("plus")} ${t("add")}</button>${cards("direction")}${more("direction")}</section><section class="panel"><h2>${t("experiment")}</h2><button data-new="experiment">${icon("plus")} ${t("add")}</button>${cards("experiment")}${more("experiment")}</section>`;
    case "settings":
      return `<section class="panel"><form id="settings-form">${input("timezone", "timezone", settings.timezone, "text", 'required maxlength="80"')}<button type="button" id="use-timezone">${t("useTimezone")}</button>${select("locale", "language", ["ru", "en"], settings.locale, false)}${input("activeProjectLimit", "limit", settings.activeProjectLimit, "number", 'min="0" max="10000" required')}<button type="submit" class="primary">${t("save")}</button></form></section><section class="panel"><h2>${t("export")}</h2><p class="meta">${t("exportHint")}</p><form id="export-form">${select("entity", "exportType", ["task", "entry", "practice", "project", "direction", "skill", "evidence", "experiment"], "task")}<button type="submit">${icon("download-simple")} ${t("export")}</button></form></section>`;
    default:
      return "";
  }
}
function render() {
 document.documentElement.lang=lang;
 root.innerHTML=`<div class="native-content">${view!=="today"?`<header class="page-head"><h1 class="page-title">${t(view)}</h1><div class="page-actions" id="native-actions"></div></header>`:""}<div id="notice" class="banner warn" role="alert" ${notice?"":"hidden"}>${e(notice)}</div>${online?body():`<section class="panel empty"><h2>${t("connection")}</h2><button id="retry">${t("retry")}</button></section>`}</div><dialog id="editor"><form id="editor-form"></form></dialog>`;
 const toolbar=root.querySelector('.toolbar');
 if(toolbar&&['practices','projects','skills'].includes(view)){
  const button=toolbar.querySelector('button[data-new]');if(button){button.classList.remove('primary');button.classList.add('accent');root.querySelector('#native-actions')?.append(button)}toolbar.remove();
 }
 sharedMarkup();wire();
}

function sharedMarkup() {
  root.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    if (
      !b.matches(".nav-item,.task-body,.check,.day,.evidence-row,.seg button")
    )
      b.classList.add("btn");
    if (b.classList.contains("icon-btn")) b.classList.add("icon", "ghost");
  });
  root
    .querySelectorAll("input:not([type=checkbox])")
    .forEach((x) => x.classList.add("input"));
  root.querySelectorAll("textarea").forEach((x) => x.classList.add("textarea"));
  root.querySelectorAll("select").forEach((x) => x.classList.add("select"));
  root.querySelectorAll(".panel").forEach((panel) => {
    if (panel.querySelector(":scope > .panel-body")) return;
    const head = panel.querySelector(":scope > .section-heading");
    if (head) {
      head.classList.add("panel-head");
      head.querySelector("h2")?.classList.add("panel-title");
    }
    const body = document.createElement("div");
    body.className = "panel-body";
    for (const child of [...panel.childNodes])
      if (child !== head) body.append(child);
    panel.append(body);
  });
}
function wire() {
  root.querySelectorAll<HTMLElement>("[data-view]").forEach(
    (x) =>
      (x.onclick = () => {
        settingsDirty = false;
        view = x.dataset.view!;
        render();
        void load().catch(showError);
      }),
  );
  root.querySelectorAll<HTMLElement>("[data-filter]").forEach(
    (x) =>
      (x.onclick = async () => {
        filter = x.dataset.filter!;
        try {
          const args = query("task");
          pages.task = await call("task_list", { limit: 20, ...args });
          render();
        } catch (err) {
          showError(err);
        }
      }),
  );
  root
    .querySelectorAll<HTMLElement>("[data-new]")
    .forEach(
      (x) =>
        (x.onclick = () =>
          editor(x.dataset.new!, undefined, { scheduledDate: x.dataset.date })),
    );
  root.querySelectorAll<HTMLElement>("[data-edit]").forEach(
    (x) =>
      (x.onclick = () => {
        const [type, id] = x.dataset.edit!.split(":");
        editor(
          type,
          rows(type).find((x) => x.id === id),
        );
      }),
  );
  root.querySelectorAll<HTMLElement>("[data-complete]").forEach(
    (x) =>
      (x.onclick = () => {
        const item = rows("task").find((y) => y.id === x.dataset.complete)!;
        void perform(item.status === "done" ? "task_reopen" : "task_complete", {
          id: item.id,
          revision: item.revision,
        });
      }),
  );
  root.querySelectorAll<HTMLElement>("[data-log]").forEach(
    (x) =>
      (x.onclick = () =>
        editor(
          "log",
          rows("practice").find((y) => y.id === x.dataset.log),
        )),
  );
  root
    .querySelectorAll<HTMLElement>("[data-evidence]")
    .forEach(
      (x) =>
        (x.onclick = () =>
          editor("evidence", undefined, { skillId: x.dataset.evidence })),
    );
  root.querySelectorAll<HTMLElement>("[data-more]").forEach(
    (x) =>
      (x.onclick = async () => {
        const type = x.dataset.more!;
        try {
          const p = await call(type + "_list", {
            cursor: pages[type].nextCursor,
            limit: 20,
            ...query(type),
          });
          pages[type] = { ...p, items: [...rows(type), ...p.items] };
          render();
        } catch (err) {
          showError(err);
        }
      }),
  );
  let searchTimer: ReturnType<typeof setTimeout>;
  root
    .querySelector<HTMLInputElement>("#task-search")
    ?.addEventListener("input", (ev) => {
      taskSearch = (ev.target as HTMLInputElement).value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        try {
          pages.task = await call("task_list", { limit: 20, ...query("task") });
          const input =
              document.querySelector<HTMLInputElement>("#task-search"),
            pos = input?.selectionStart;
          render();
          const next = document.querySelector<HTMLInputElement>("#task-search");
          next?.focus();
          if (next && pos !== null && pos !== undefined)
            next.setSelectionRange(pos, pos);
        } catch (err) {
          showError(err);
        }
      }, 350);
    });
  root
    .querySelector("#refresh")
    ?.addEventListener("click", () => void load().catch(showError));
  root
    .querySelector("#retry")
    ?.addEventListener("click", () => void load().catch(showError));
  root.querySelector("#lang")?.addEventListener("click", () => {
    lang = lang === "ru" ? "en" : "ru";
    render();
  });
  const captureForm = root.querySelector<HTMLFormElement>("#capture-form");
  captureForm?.querySelector("textarea")?.addEventListener("input", (ev) => {
    draft = (ev.target as HTMLTextAreaElement).value;
    try {
      localStorage.setItem("delta.lifeos.draft", draft);
    } catch {
      document.querySelector("#draft-note")!.textContent = t("draftError");
    }
  });
  captureForm?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const text = draft.trim();
    if (!text) return;
    void perform(
      "entry_create",
      { data: { text, kind: "note", source: "manual" } },
      () => {
        draft = "";
        try {
          localStorage.removeItem("delta.lifeos.draft");
        } catch {}
      },
    );
  });
  root.querySelectorAll<HTMLElement>("[data-day]").forEach(
    (x) =>
      (x.onclick = async () => {
        selectedDate = x.dataset.day!;
        await dayLoad();
      }),
  );
  root
    .querySelector("#load-day")
    ?.addEventListener("click", () => void dayLoad());
  root
    .querySelector<HTMLInputElement>("#journal-date")
    ?.addEventListener("change", async (ev) => {
      journalDate = (ev.target as HTMLInputElement).value;
      try {
        [pages.entry, pages.task] = await Promise.all([
          call("entry_list", { ...query("entry"), limit: 20 }),
          call("task_list", { ...query("task"), limit: 20 }),
        ]);
        render();
      } catch (err) {
        showError(err);
      }
    });
  root.querySelectorAll<HTMLElement>("[data-month]").forEach(
    (x) =>
      (x.onclick = async () => {
        const d = new Date(month + "-01T12:00:00Z");
        d.setUTCMonth(d.getUTCMonth() + Number(x.dataset.month));
        month = d.toISOString().slice(0, 7);
        try {
          calendar = await call("calendar", {
            from: month + "-01",
            to:
              month +
              "-" +
              new Date(
                Number(month.slice(0, 4)),
                Number(month.slice(5)),
                0,
              ).getDate(),
          });
          render();
        } catch (err) {
          showError(err);
        }
      }),
  );
  root.querySelector("#use-timezone")?.addEventListener("click", () => {
    root.querySelector<HTMLInputElement>("[name=timezone]")!.value =
      Intl.DateTimeFormat().resolvedOptions().timeZone;
  });
  root
    .querySelector<HTMLFormElement>("#settings-form")
    ?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const f = new FormData(ev.currentTarget as HTMLFormElement);
      void perform(
        "settings_update",
        {
          revision: settings.revision,
          data: {
            timezone: f.get("timezone"),
            locale: f.get("locale"),
            activeProjectLimit: Number(f.get("activeProjectLimit")),
          },
        },
        () => {
          settingsDirty = false;
          lang = f.get("locale") as "ru" | "en";
        },
      );
    });
  root
    .querySelector<HTMLFormElement>("#export-form")
    ?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      try {
        const type = String(
          new FormData(ev.currentTarget as HTMLFormElement).get("entity"),
        );
        const data = await all(type);
        const url = URL.createObjectURL(
          new Blob(
            [
              JSON.stringify(
                { format: "delta-lifeos-v1", entity: type, items: data },
                null,
                2,
              ),
            ],
            { type: "application/json" },
          ),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "lifeos-" + type + ".json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (err) {
        showError(err);
      }
    });
}
async function dayLoad() {
  try {
    [pages.task, pages.entry] = await Promise.all([
      call("task_list", { date: selectedDate, limit: 20 }),
      call("entry_list", { date: selectedDate, limit: 20 }),
    ]);
    render();
  } catch (err) {
    showError(err);
  }
}
function localInput(v: string) {
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function editor(type: string, item?: Item, defaults: any = {}) {
  ++loadSeq;
  const dialog = root.querySelector<HTMLDialogElement>("#editor")!,
    form = root.querySelector<HTMLFormElement>("#editor-form")!;
  const x = item || defaults;
  const editing = !!item && type !== "log";
  let fields = "";
  if (type === "task") {
    fields =
      input("title", "title", x.title, "text", 'required maxlength="240"') +
      area("description", "description", x.description) +
      `<div class="field-grid">${select("status", "status", x.status === "done" ? ["done"] : ["inbox", "planned", "doing", "cancelled"], x.status || "inbox")}${input("scheduledDate", "scheduledDate", x.scheduledDate, "date")}${input("deadline", "deadline", x.deadline, "date")}${input("estimateMinutes", "estimate", x.estimateMinutes, "number", 'min="0" max="100000"')}</div>` +
      projectSelect(x.projectId) +
      area(
        "checklist",
        "checklist",
        (x.checklist || []).map((v: any) => v.text).join("\n"),
      ) +
      (x.checklist || [])
        .map(
          (v: any) =>
            `<label class="inline"><input type="checkbox" name="checked_${v.id}" ${v.done ? "checked" : ""}>${e(v.text)}</label>`,
        )
        .join("") +
      input(
        "repeatDays",
        "repeat",
        x.repeat?.days || 0,
        "number",
        'min="0" max="365"',
      ) +
      select("missed", "missed", ["skip", "carry"], x.repeat?.missed || "skip");
  } else if (type === "entry" || type === "log") {
    fields =
      (type === "entry"
        ? select(
            "kind",
            "kind",
            ["note", "sleep", "activity", "learning", "reflection"],
            x.kind || "note",
          )
        : `<p class="muted">${e(x.title)}</p>`) +
      area("text", "text", type === "log" ? "" : x.text, 'maxlength="12000"') +
      input(
        "date",
        "date",
        type === "log" ? today() : x.date || today(),
        "date",
        "required",
      ) +
      `<div class="field-grid">${input("value", "value", type === "log" ? "" : x.value, "number", 'step="any"')}${input("unit", "unit", x.unit || "")}</div>` +
      `<div class="field-grid">${input("at", "start", x.at ? localInput(x.at) : "", "datetime-local")}${input("endAt", "end", x.endAt ? localInput(x.endAt) : "", "datetime-local")}</div><p class="meta">${Intl.DateTimeFormat().resolvedOptions().timeZone}</p>`;
  } else if (type === "practice") {
    fields =
      input("title", "title", x.title, "text", 'required maxlength="240"') +
      select(
        "kind",
        "kind",
        ["custom", "sleep", "activity", "learning"],
        x.kind || "custom",
      ) +
      input("minimum", "minimum", x.minimum) +
      input("unit", "unit", x.unit) +
      input("target", "target", x.target, "number", 'min="0" step="any"') +
      input("weekdays", "weekdays", (x.weekdays || []).join(",")) +
      `<label class="inline"><input name="active" type="checkbox" ${x.active !== false ? "checked" : ""}>${t("active")}</label>`;
  } else if (type === "evidence") {
    fields =
      input("title", "title", x.title, "text", 'required maxlength="240"') +
      area("text", "text", x.text) +
      `<label>${t("skill")}<select name="skillId">${rows("skill")
        .map(
          (s) =>
            `<option value="${s.id}" ${s.id === x.skillId ? "selected" : ""}>${e(s.title)}</option>`,
        )
        .join("")}</select></label>` +
      select(
        "assistance",
        "assistance",
        ["independent", "hint", "generated", "reproduced"],
        x.assistance || "independent",
      ) +
      input("date", "date", x.date || today(), "date");
  } else {
    fields =
      input("title", "title", x.title, "text", 'required maxlength="240"') +
      area("description", "description", x.description);
    if (type !== "skill")
      fields += select(
        "status",
        "status",
        ["active", "paused", "done", "cancelled"],
        x.status || "active",
      );
    if (type === "project") fields += input("nextStep", "nextStep", x.nextStep);
    if (type === "direction")
      fields +=
        area("reason", "description", x.reason) +
        input("reviewDate", "date", x.reviewDate, "date");
    if (type === "experiment")
      fields +=
        area("hypothesis", "description", x.hypothesis) +
        input("from", "start", x.from, "date") +
        input("to", "end", x.to, "date");
  }
  form.innerHTML = `<div class="section-heading"><h2>${t(editing ? "edit" : type === "log" ? "log" : "add")} · ${t(type === "log" ? "practice" : type)}</h2><button type="button" id="close-dialog" class="icon-btn" aria-label="${t("close")}">${icon("x")}</button></div>${fields}<p id="editor-error" class="notice" hidden role="alert"></p><div class="dialog-actions">${editing ? `<button type="button" id="delete-item" class="danger">${t("remove")}</button>` : ""}<button type="button" id="cancel-dialog">${t("cancel")}</button><button class="primary" type="submit">${t("save")}</button></div>`;
  form
    .querySelector("#close-dialog")!
    .addEventListener("click", () => dialog.close());
  form
    .querySelector("#cancel-dialog")!
    .addEventListener("click", () => dialog.close());
  form.querySelector("#delete-item")?.addEventListener("click", () => {
    if (confirm(t("confirmDelete")))
      void perform(
        type + "_delete",
        { id: item!.id, revision: item!.revision },
        () => dialog.close(),
      );
  });
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    if (busy) return;
    const f = new FormData(form),
      data: any = {};
    for (const [k, v] of f.entries()) if (String(v) !== "") data[k] = v;
    for (const k of ["estimateMinutes", "value", "target"])
      if (data[k] !== undefined) data[k] = Number(data[k]);
    if (type === "task") {
      for (const k of Object.keys(data))
        if (k.startsWith("checked_")) delete data[k];
      const lines = String(f.get("checklist") || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      data.checklist = lines.map((text, i) => ({
        id: x.checklist?.[i]?.id || requestId(),
        text,
        done:
          x.checklist?.[i]?.text === text
            ? f.has("checked_" + x.checklist[i].id)
            : false,
      }));
      data.repeat = Number(data.repeatDays)
        ? { days: Number(data.repeatDays), missed: data.missed }
        : null;
      delete data.repeatDays;
      delete data.missed;
      if (editing)
        for (const k of [
          "scheduledDate",
          "deadline",
          "estimateMinutes",
          "projectId",
        ])
          if (data[k] === undefined) data[k] = null;
    }
    if (type === "practice") {
      data.active = f.has("active");
      data.weekdays = String(data.weekdays || "")
        .split(",")
        .filter(Boolean)
        .map(Number);
    }
    if (type === "entry" || type === "log") {
      for (const k of ["at", "endAt"])
        if (data[k]) data[k] = new Date(data[k]).toISOString();
      data.text ??= "";
      if (type === "entry" && !editing) data.source = "manual";
      if (data.at)
        data.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    busy = true;
    form
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach((b) => (b.disabled = true));
    try {
      await mutation(
        type === "log"
          ? "practice_log"
          : type + (editing ? "_update" : "_create"),
        {
          ...(editing
            ? { id: item!.id, revision: item!.revision }
            : type === "log"
              ? { id: item!.id }
              : {}),
          data,
        },
      );
      dialog.close();
      await load();
    } catch (err: any) {
      const box = form.querySelector<HTMLElement>("#editor-error")!;
      box.hidden = false;
      box.textContent =
        err?.code === "conflict" || err?.message === "conflict"
          ? t("conflict")
          : t("error");
    } finally {
      busy = false;
      form
        .querySelectorAll<HTMLButtonElement>("button")
        .forEach((b) => (b.disabled = false));
    }
  };
  sharedMarkup();
  dialog.showModal();
}
function presentation(c: AppContext) {
  const changed = lang !== c.language || (!!c.surface && c.surface !== surface);
  lang = c.language;
  applyThemeTokens(c.tokens);
  document.documentElement.dataset.theme = c.theme;
  if (c.surface) {
    surface = c.surface;
    view = c.surface;
  }
  if (changed && !root.querySelector<HTMLDialogElement>("dialog")?.open)
    render();
}
export async function openLegacy(bridge: Awaited<ReturnType<typeof connectPlugin>>,next='projects') {
 host=bridge;surface=params.get('surface')||'';view=next;presentation(bridge.context);await load();

}
