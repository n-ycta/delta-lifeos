# LifeOS integration

1. Install the LifeOS UI catalog/broker changes in Delta UI and the matching server allowlist in Delta Web. No wildcard grants or legacy Vector capabilities are kept.
2. Install the reviewed process package as `dev.delta.lifeos` / component `lifeos`, with scopes `register:lifeos`, `call:storage.document_get`, `call:storage.document_put`. The process manifest registers the exact capabilities, including chunked/revisioned workspace transport.
3. Use the same Storage node for migration. Stop Vector writers first. LifeOS retains the old namespace and a migration backup; the old service must not continue independently writing the old namespace.
4. Install `delta-lifeos.delta-app` from the reviewed catalog. The app and all widgets use the same process. Surfaces carry presentation context only, never permission grants.
5. After testing, remove the old Vector runtime/UI assets. The repository itself was renamed to preserve history.
6. Deploy updated Web/Desktop/Android hosts containing the new UI. Source publication does not replace running binaries. Delta UI's host-sync workflow can repin and release hosts after shared checks succeed.

The main Core registry entry and the UI app catalog are updated to LifeOS 0.2.0 with hashes of the actual built artifacts. The old Vector catalog entry is removed. Existing workbench references migrate to the new app ID while preserving widget IDs, surfaces and geometry.
