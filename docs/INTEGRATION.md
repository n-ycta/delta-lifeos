# Host integration and rollout

1. Apply the supplied patches to Delta UI (`src/sdk/pluginApi.ts`, `src/pages/plugins/PluginApp.tsx`) and Delta Web (`server/apps.mjs`). These add the exact Vector API list at both broker boundaries, preserving Media's list and denying other app/capability pairs. The UI patch also exports the real shared styles, controls and Phosphor icon helpers for standalone plugins, aligns SDK typography with host sizing, and preserves safe symbolic error codes without leaking server exception text.
2. Run host tests and build. No Core schema patch or MCP implementation change is necessary. The service declares `metadata.ui.id = dev.delta.vector`, allowing the existing MCP gateway to discover capabilities.
3. Publish this plugin's process and UI assets with verified hashes; review and add actual release entries to Core's plugin registry and the host's app catalog. The process manifest requires Core and Storage and declares least-privilege service scopes. The UI manifest declares presentation surfaces, not permission grants.
4. Follow `delta-ui/docs/HOST-UI-SYNC.md` to repin, test and publish Web/Desktop/Android. Pushing source is not a native install. Keep owner sessions and existing user data intact.
5. On a disposable node, install Storage and Vector, authorize only required API scopes, open Vector, create/complete/reopen a task, write a diary entry, log a practice, embed two surfaces, reload and restart the service. Create an MCP profile permitting task create/list only and verify diary/settings denial and revocation.
6. Back up the node before production installation. Keep one Vector service on the authoritative node. No automatic replication or backend migration is added by Vector.

## Acceptance coverage

`tests/vector.test.mjs`: durable mutations, idempotency, conflicts, recurrence, scoped denial, sleep/timezone, pagination size, tombstones, persistence failures and corrupt-state rejection.

`tests/integration.mjs`: real Core registration/routing, real Storage documents, process restart, existing MCP catalog and scoped calls/revocation.

`tests/browser.mjs`: real SDK source/origin/channel bridge with a test parent, real Core/Storage writes, CRUD, theme inheritance, RU/EN, desktop/mobile/narrow panels, error retention and two distinct simultaneous surfaces. This is not physical-device or released-host acceptance.

## Published host changes

The required source changes are published in:

- [Delta UI SDK and Vector broker grants](https://github.com/n-ycta/delta-ui/commit/e319c2da5520baa6c4073fac11d3f752ceea98a1)
- [Delta Web Vector authorization](https://github.com/n-ycta/delta-web/commit/e0da2466c95f6c1e5a47f6f85856c6cd84b3e43b)

Use compatible host releases containing these changes. A GitHub commit or a plugin release does not prove that an installed Web/Desktop/Android host has been updated. The bundled SDK snapshot corresponds to the shared SDK sources in the linked UI commit.
