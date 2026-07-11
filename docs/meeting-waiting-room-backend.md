# Meeting waiting-room backend

Task 537 makes `meeting_waiting_entries` the sole persisted admission state and keeps every mutation behind server RPCs.

## State flow

1. `request_meeting_waiting_admission` validates JWT identity, session/room state, join policy, bans/blocks/timeouts, a bounded optional message, and an idempotency key.
2. Host/cohost/authorized moderators bypass waiting; other allowed users receive a private `waiting` row with a 15-minute maximum lifetime.
3. Hosts/cohosts use single or bulk decision RPCs. Self-admission is rejected and admitted users still pass the Task 535 token capability gate.
4. Requesters may cancel only their own waiting request.
5. Deterministic expiry closes stale requests, locked/ended rooms, and requests left without an active host/cohost for two minutes.

## Notifications and Realtime

Insert and transition triggers cover both the explicit request service and Task 535's token fallback. Hosts/cohosts receive private notification-inbox rows on request; requesters receive admitted/denied/expired/cancelled notifications. The triggers never include invitation secrets or private meeting content.

`meeting_waiting_entries` is in `supabase_realtime` with `REPLICA IDENTITY FULL`. RLS allows a requester to see only their row and authorized waiting-room managers to see that room's list. Direct insert/update/delete grants are revoked, so a client cannot self-admit even if it crafts a Realtime/table request. `meetingWaitingRoomRealtimeService` deduplicates changes, reconnects with bounded backoff, and removes channels on cleanup.

## Audit and failure behavior

Every status transition creates one idempotent `meeting_events.waiting_room_changed` record and one community audit entry. User messages are not copied into audit logs. Host disconnect is derived from provider-authoritative participant state written by Task 536. Before every token authorization, the Edge function executes deterministic expiry so an expired or hostless request cannot retain access.

Hosted actor/Realtimes tests require a disposable Supabase project. `supabase/tests/meeting_waiting_room_backend.sql` verifies RPC-only mutation and publication structure after migrations are applied.
