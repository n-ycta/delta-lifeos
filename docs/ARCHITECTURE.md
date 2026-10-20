# Architecture

- `server/lifeos.mjs`: retained Vector entity service, exact scoped API, serial transactions, revisions, request idempotency and facts.
- `server/workspace.mjs`: LifeOS schema, shared task/skill projection, migration of captured notes into diary documents, optional task reward integration, principal-bound checksummed chunk uploads, revision-checked commits.
- `server/persistence.mjs`: authoritative Storage adapter with non-destructive legacy migration, atomic file-mode adapter.
- `src/main.ts`: one real SDK connection, host theme inheritance and navigation.
- `src/vector.ts`: retained projects/directions/experiments/practices/evidence editors, using the same connection/service.
- `src/lifeos/`: modular journal, tasks, habits, skill canvas, planner, calendar, statistics and vault UI. `delta-adapter.js` replaces standalone storage with server revisioned persistence. No owner credentials are exposed.
- `src/delta-theme.css`: layout adaptation using the public Delta UI token contract, not a look-alike hardcoded palette.
- `scripts/build-lifeos-runtime.mjs`: deterministic IIFE asset assembly with vendored offline YAML/ZIP libraries and Phosphor symbol sprite.
- `server/contract.mjs`: one process manifest and portable app manifest, 13 widget surfaces.

Full workspace reads are revision-pinned chunks. Upload staging is bound to the authenticated invocation principal, expires after five minutes, has bounded parts and memory usage, and does not mutate persistent state until a validated commit. Native entity mutations and workspace commits use the same serialized queue. Failed writes leave the old authoritative state intact.

The original standalone lifeos.v1 browser store is not read automatically. Import requires user action and schema validation. Browser cache cannot overwrite server data during startup.
