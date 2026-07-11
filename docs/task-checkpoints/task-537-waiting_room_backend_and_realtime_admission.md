# Task 537 checkpoint: Waiting-room backend and Realtime admission

## Delivered

- Idempotent request-to-join, single/bulk admit/deny, requester cancel, deterministic expiry, own-state, and host-list RPCs.
- Server-derived display identity, optional bounded message, invitation/inviter linkage, expiry, decision note/metadata, and host notification timestamps.
- Host/cohost/permission gate, self-admission prevention, ban/block/timeout and room/session validation.
- Trigger-complete host/requester notifications, transition audit, and sequenced meeting events, including token fallback inserts.
- RLS-private Realtime publication with dedupe/reconnect/cleanup service and mock parity.
- Token acquisition refreshes expiry first; only an admitted row permits waiting-room access.

## Validation status

- `node scripts/meeting-waiting-room-backend-smoke.mjs`: **PASS**.
- Task 535 meeting-token security smoke: **PASS**.
- `npm run typecheck`: **PASS**.
- `npm run supabase:migrations:check`: **PASS** (173 ordered, BOM-free migrations).
- `npm run supabase:qa`: **PASS**.
- `npm run mock:smoke`: **PASS**.
- `npm run build`: **PASS**, with the pre-existing ineffective voice dynamic-import and large-chunk warnings.
- `npm run qa:smoke`: **FAILED OUTSIDE TASK SCOPE** at desktop-only smoke because concurrent user-owned `src/styles.css` contains a small `max-width` media-query pattern. Task 537 did not modify renderer UI/styles and did not alter or stage that work.
- Hosted multi-actor RLS/Realtime delivery, SQL actor test, and provider token-after-admission evidence: **BLOCKED** until a configured disposable Supabase/LiveKit staging environment exists. No hosted pass is claimed.
- Renderer performance budget: not rerun because no renderer import graph or stylesheet changed.

## Security invariants

- Authenticated clients have no direct insert/update/delete grant on waiting rows.
- Requesters see only self; managers see only rooms they may admit.
- Hosts cannot self-admit and lower roles cannot apply decisions.
- Private request messages never enter notifications, audit reasons, or public Realtime topics.
