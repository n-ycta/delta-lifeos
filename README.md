# Delta Vector

A plugin-first personal workspace for tasks, journal, calendar, practices, projects and skill evidence. No built-in AI, MCP listener, XP, streak penalties or automatic psychological scoring.

## Status

Version 0.1.0 is an initial implementation. Source publication is not an installed or published official catalog release. The UI requires the matching host changes linked in `docs/INTEGRATION.md`. Installing this source does not update existing Web/Desktop/Android binaries.

## Runtime

- Delta Core >=0.4.3 <0.5.0.
- Node.js >=22.12 (24 recommended).
- Delta Storage >=0.4.0 on the selected service node.
- A compatible Delta UI/Web host with explicit Vector grants (see `docs/INTEGRATION.md`).

Run one Vector service per selected data store: it serializes changes and owns its Storage document. Multiple UI surfaces and clients share that service. This is a single-owner service, not a multi-tenant database or an offline replication engine. Core peer trust is the security boundary; pairing does not preserve an end-user identity across peers.

## Development

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run dev
npm run package:plugin
```

The source includes `vendor/delta-ui-sdk.tgz`, a reviewed local snapshot of the actual shared SDK plus the accompanying SDK export changes. This is not a published upstream SDK version. `scripts/vendor-sdk.mjs` can regenerate it from a sibling Delta UI checkout after applying the handoff patch. Building the plugin itself does not require a sibling checkout.

The standalone UI intentionally shows a connection instruction; it does not silently create a second local dataset. Open it through a Delta host. For end-to-end development, place `delta-ui`, `delta_db`, `delta-mcp` and this repository as siblings, install their dependencies, and run:

```sh
CORE_BINARY=/path/to/delta npm run test:integration
CORE_BINARY=/path/to/delta CHROMIUM_PATH=/path/to/chromium npm run test:browser
```

These commands create disposable Core/Storage/MCP profiles and real service calls. The test host's loopback API proxy is test-only; never deploy it publicly. Browser tests use the real UI channel and a test parent rather than claiming released-host installation coverage.

## Service

`server/main.mjs` uses supervisor-provided `DELTA_URL` / `DELTA_TOKEN`. Scopes: `register:vector`, `call:storage.document_get`, `call:storage.document_put`. Keep the service token private; it never enters plugin frames. `STORAGE_COMPONENT` defaults to `storage`; optional `STORAGE_NODE` chooses an existing reachable storage node. File persistence is explicit with `VECTOR_STORAGE=file` and `DATA_DIR`; it is intended for development or an intentional standalone deployment, never an automatic fallback on Storage failure.

State is persisted in one owner-isolated Storage document (`delta_vector/state`). The owner is the stable service principal. Changing its token **name**, principal kind or peer route changes that storage identity. Keep token names stable during upgrades. Only Vector should write this document.

## Functionality

- Tasks: inbox, planned, doing, done/cancelled; schedule separate from deadline; estimate, checklist and recurrence (`days`, `missed: skip|carry`). Complete/reopen capabilities are separate from generic editing. Completing a repeating task creates one next occurrence. Remove that occurrence before reopening its parent to avoid duplicates.
- Journal: free text, typed observations, numeric values, intervals, time zone and source. Local drafts remain on this browser; they are not a backup.
- Practices: configurable type, unit, minimum step, target and weekday metadata; log into the same journal. Scheduling metadata is not an OS reminder service.
- Projects/directions/experiments: basic CRUD and project limit advisory.
- Skills: linked evidence and neutral assistance labels (independent, hint, generated, reproduced).
- Calendar: monthly overview and selected-day plan versus recorded observations.
- Review: exact counts for 14 days, with absent records labeled unknown.
- Surfaces: today, capture, tasks, journal, calendar, practices, projects, skills, review. Theme tokens and typography apply through `@delta/ui/sdk/client`; panels, buttons and fields use `@delta/ui/sdk/styles.css`; select behavior uses `@delta/ui/sdk/controls`; all interface icons use official Phosphor assets through `@delta/ui/sdk/icons`. Fonts are bundled, RU/EN provided.
- Export: paginated per-entity JSON via API and UI. No credentials in exports.

## API and security

The complete capability schemas are generated from `server/contract.mjs`; each method is independently scoped. `vector.entry_list`, `vector.summary`, `vector.calendar` and `vector.export` can expose private observations; grant them separately. Do not grant an agent `vector.*` if it only needs tasks. List pages allow at most 20 items and stay below 44 KB of rows. UI does not receive Core tokens or arbitrary-node authority.

Mutations require a stable `requestId`. Updates/deletes and task completion/reopening require the current entity `revision`. Duplicate successful requests return their cached original result; changing arguments under the same request ID fails. Idempotency cache is bounded to 64 successful requests; clients must not replay arbitrarily old creates. UI retains a request ID across an ambiguous failure for identical input.

Deletes leave content-free tombstones. Completed tasks are facts used by the journal/review layer, not duplicated diary writes. Missing data is not failure; assistance is not a moral score.

## Initial limits

- One serialized service writer; no cross-process compare-and-swap in Storage.
- State cap 900 KB, including tombstones and request cache; capacity fails explicitly without discarding data. This release is for small personal deployments. Automatic archive/compaction and scalable per-entity Storage indexing are not implemented.
- Lists show loaded pages, with Load more. Filters are explicit; summary/calendar counts are computed from the service state, not a client sample.
- No offline writes, background notifications, workout programming, spaced repetition, external health imports, Media activity imports, drag-to-reschedule, arbitrary saved widget filters or automatic agent inference.
- Weekday/target practice fields are editable metadata, not an automatically enforced training schedule.
- Two different surfaces can run simultaneously on the inspected host; repeated slots of the same surface use the host's shared-frame semantics.

## Release

`npm run package:plugin` builds `release/delta-vector.delta-app` and `release/delta-vector.tar.gz` plus manifests and `SHA256SUMS`. Publish tested assets before registering their real URLs/checksums. Do not insert speculative release URLs in production registries. The supplied workflow publishes tag builds, but CI success and host rollout must be verified separately.

Apache-2.0. Delta SDK is reused under the same license; fonts retain their packaged OFL notices.
