# Delta LifeOS

Delta plugin/application replacing Delta Vector. Component: `lifeos`. Plugin/UI identity: `dev.delta.lifeos`. Version: 0.2.1.

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

The Git repository is renamed, not deleted: commit history is preserved. `delta_vector/state` is copied to `delta_lifeos_backup/state` and then `delta_lifeos/state` on first load. The original namespace is left intact. File mode similarly preserves `vector.json` and `vector.pre-lifeos.json` before creating `lifeos.json`. Tasks, skills and existing entry IDs are retained. Existing user-defined criteria and LifeOS settings reside alongside the retained Vector entities.

Install LifeOS against the same authoritative Storage as Vector. Stop the old Vector service before actively editing the migrated data; simultaneous old/new services are not a replication mechanism. Verify LifeOS, then remove the old runtime. Do not delete the old data namespace. Host workbench identity migration preserves layout/surface settings and keeps a pre-migration browser backup.

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
