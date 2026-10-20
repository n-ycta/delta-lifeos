# Changelog

## 0.3.2

- Restore calendar day-cell heights; compact button styles no longer collapse content cells.
- Give dropdown carets explicit 16px dimensions and the planner scope selector enough width.
- Replace the persistent planner banner with initially collapsed help.
- Retry the SDK handshake until a bounded deadline and separate RPC timeout from initialization.
- Journal pending edits before sending, capture diary text on blur, and offer explicit local-draft recovery.
- Reconcile a lost commit acknowledgement by write ID; never apply a stale background read over newer local edits.
- Test delayed host initialization and repeated LifeOS/Media SDK-fixture switching through the actual root FrameHost.
