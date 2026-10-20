# Changelog

## 0.3.4

- Replace dot placeholders and tall calendar strips with compact day cells, deadline counts and a readable selected-day agenda.
- Show diamond icons consistently; turn mobile daily statistics into labelled cards without clipped columns.
- Add a themed, keyboard-accessible date picker throughout LifeOS and its workspace forms.
- Replace the skill icon name selector with a visual SVG icon grid.
- Correct review-panel spacing on mobile and desktop.
- Synchronize plugin, app and service version metadata (0.3.3 release service metadata was stale).

## 0.3.3

- Keep every habit row inside its card; align weekly controls on mobile.
- Replace category chips with a shared accessible selector; support editing existing habits and creating categories in nested dialogs.
- Secure random-ID fallback and bundled SHA-256 support WebViews without randomUUID/subtle.
- Retain pending drafts on persistence errors, expose error codes and retry on reconnect.
- Guard stale async navigation so rapid workspace/app transitions cannot undo newer navigation.
- Add populated desktop/mobile regression coverage against actual Core and Storage, including service restart.

## 0.3.2

- Restore calendar day-cell heights; compact button styles no longer collapse content cells.
- Give dropdown carets explicit 16px dimensions and the planner scope selector enough width.
- Replace the persistent planner banner with initially collapsed help.
- Retry the SDK handshake until a bounded deadline and separate RPC timeout from initialization.
- Journal pending edits before sending, capture diary text on blur, and offer explicit local-draft recovery.
- Reconcile a lost commit acknowledgement by write ID; never apply a stale background read over newer local edits.
- Test delayed host initialization and repeated LifeOS/Media SDK-fixture switching through the actual root FrameHost.
