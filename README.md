# Delta LifeOS

Delta plugin/application replacing Delta Vector. Component: `lifeos`. Plugin/UI identity: `dev.delta.lifeos`. Version: 0.3.1.

## Included

- Journal: Markdown/YAML entries, 13 custom field types, scheduled field/template assignment, ZIP import/export.
- Tasks and recurring habits: deadlines, priorities, categories, transfers, exceptions, configurable optional rewards and penalties in diamonds.
- Skills: arbitrary nesting, 3–100 achievement criteria, custom levels, evidence/history, canvas and tree views. No percentage-based skill level.
- Time: interactive 24-hour planner, base/weekday templates and isolated date exceptions.
- Calendar, balance/statistics, profile and activity.
- Existing Vector functions retained: quick capture, practices (including sleep/activity/learning logs), projects, directions, experiments and skill evidence. Tasks and skills share the same backend entities between the application and native widgets.
- Thirteen declared composable surfaces: today, capture, tasks, journal, calendar, practices, projects, skills, review, habits, planner, rewards, statistics.

No decorative slogans. Theme, typography, controls and radii come from the actual `@delta/ui` SDK and host theme tokens, including Mocha/Latte/Gruvbox/Tokyo. Icons use Phosphor; currency uses a faceted gemstone, not a plain rhombus.

## Runtime

Node.js >=22.12 (24 recommended), Delta Core >=0.4.3 <0.5.0, Delta Storage >=0.4.0. The Web/native host must include the LifeOS broker allowlist and UI catalog update. Publishing source alone does not update an installed host.

The process registers `lifeos.*` capabilities with Core; the UI receives only exact broker grants through the origin/channel-pinned Plugin SDK. No Core owner token, GitHub token or native IPC credential enters an iframe. Backend persistence is authoritative; local browser storage is only a last-saved cache. A stale write is rejected with a revision conflict, never silently merged over another client.

## Migration from Vector

The Git repository is renamed, not deleted: commit history is preserved. When the credential identity is unchanged, `delta_vector/state` is copied to `delta_lifeos_backup/state` and then `delta_lifeos/state` on first load. The original namespace is left intact. File mode similarly preserves `vector.json` and `vector.pre-lifeos.json` before creating `lifeos.json`. Tasks, skills and existing entry IDs are retained. Existing user-defined criteria and LifeOS settings reside alongside the retained Vector entities.

Install LifeOS against the same authoritative Storage as Vector. Stop the old Vector service before actively editing the migrated data; simultaneous old/new services are not a replication mechanism. Verify LifeOS, then remove the old runtime. Do not delete the old data namespace. For the normal `dev.delta.vector` → `dev.delta.lifeos` credential change, run the Core repair command: it uses short-lived owner-authorized scoped credentials to copy and verify isolated documents, then revokes them. It refuses to overwrite existing LifeOS data. Host workbench identity migration preserves layout/surface settings and keeps a pre-migration browser backup.

For existing standalone LifeOS data, use its ZIP export and the LifeOS profile import. Import is explicit; the plugin never silently replaces server data with browser-local state.

## Development

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run dev
npm run package:plugin
```

Open the app through a Delta host. A top-level standalone plugin window intentionally asks for Delta; it does not create a separate local dataset. `LIFEOS_STORAGE=file DATA_DIR=/path node server/main.mjs` selects explicit development file persistence; default mode uses Delta Storage. Core connection comes from `DELTA_URL` and the service-scoped `DELTA_TOKEN` provisioned by the host.

`npm run package:plugin` emits `delta-lifeos.tar.gz` (process + UI) and `delta-lifeos.delta-app` (portable app), manifests and SHA256SUMS. Runtime libraries are bundled; no npm install is required for the installed process package.

## Verification

`npm test`: service compatibility, revisions/idempotency, workspace upload validation, shared entity projections, durable restart, data migration and scoped denial.

`npm run test:browser`: actual shared SDK origin/channel fixture with the real durable LifeOS service, responsive application/views and widget surfaces. This is a host fixture, not a claim about every installed deployment or physical phone.

`CORE_BINARY=/path/to/delta npm run test:integration`: real Core registration/routing, real Storage, service restart, MCP discovery, scoped task calls and journal denial/revocation. Requires sibling checkouts of `delta_db` and `delta-mcp`.

## Storage boundaries

Each diary entry is a Markdown document in the workspace and becomes a separate `.md` in ZIP export. The backend uses the current Delta Storage document contract (the inherited document capacity is enforced), not browser-local authority. Workspace uploads are chunked under bridge request limits, checksummed, revision-checked and committed atomically to Storage. Interrupted uploads never replace the workspace. Optional browser folder export still requires a user-selected folder and browser support.

Rules are optional, project-limit warnings can be disabled with 0, and skill progression is manual by default. Background browser closure is not a scheduler: overdue checks run when the app is open. No built-in AI scorer, cloud replication or automatic external verification of evidence is claimed.

## 0.3.1 repair batch

One LifeOS navigation across retained domain editors. Uses the same public Console control classes, type scale, geometry and host tokens. Root FrameHost opens it through `/apps/dev.delta.lifeos`, exactly as Media; running frames survive switching apps. LifeOS registers while waiting for Storage and reconnects without loading empty defaults.

## 0.3.2 reliability fixes

- Repeated host handshake announcements tolerate delayed listeners; RPC requests have a separate 35-second budget.
- Pending snapshots are journaled locally before transport, scoped to the parent host origin. Recovery is explicit; a draft never silently overwrites server data.
- A lost commit acknowledgement is reconciled by the same write ID; stale background reads cannot overwrite edits.
- Calendar cells and content rows no longer inherit compact button heights. Planner help starts collapsed; select icons have explicit 16px geometry.

## 0.3.3 acceptance

`npm run test:habits` checks category creation/selection/editing, multiple habit rows and persistence with Web Crypto secure-context APIs disabled. `CORE_BINARY=/path/to/delta npm run test:filled` uses an isolated real Core and real Storage file handlers, checks a LifeOS service restart, and captures populated routes at 1440/390px. The live harness expects sibling checkouts `delta_db` (with its dependencies installed); MCP is optional for this harness. No production profile is used.

A red save status is never treated as success: export before discarding unsaved data. Profile exposes the error code and retry. HTTPS or a trusted VPN remains recommended; compatibility fallbacks do not make HTTP confidential. Native Android APK/device behavior is verified separately by the host release pipeline, not by the browser tests.
