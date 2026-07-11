# Meeting Waiting Room UI

## Host and cohost queue

The People dock renders the waiting queue only when the server-derived meeting capabilities include `canAdmit`. The queue loads through `meetingWaitingRoomService`, subscribes to the room-scoped Realtime channel, and performs a bounded reconciliation every 30 seconds to recover from missed or stale events.

Each request shows the participant identity, requested role, invite/direct-request context, request time, and optional request message. Admit and Deny are server-authoritative operations. A successful-looking UI state is never applied before the service returns success.

Bulk Admit All and Deny All require an explicit confirmation that includes the current affected count. Per-entry and bulk operation keys reject duplicate clicks while a request is in flight. Supabase RPC permissions remain the enforcement boundary; the frontend capability check is presentation only.

## Waiting participant privacy

A participant awaiting admission receives only their own waiting-entry updates. While the meeting client is in an admission-only state, Picom does not render the meeting stage, participant dock, or meeting controls. This prevents cached or underlying participant information from appearing beneath the status surface.

The status surface distinguishes waiting, admitted, denied, expired, cancelled, locked, and ended outcomes. Cancellation calls the server-backed waiting-room service before the local status changes. Admission continues through the existing short-lived token authorization flow.

## Failure and recovery

- Realtime reconnects with bounded backoff and the UI reconciles the authoritative queue after connection.
- A host disconnect does not turn an unresolved request into a success.
- Non-waiting and deleted events are removed from the host queue.
- Expired requests can retry; denied, cancelled, locked, and ended outcomes remain explicit.
- RLS and security-definer RPC checks remain responsible for preventing unauthorized admission operations.
