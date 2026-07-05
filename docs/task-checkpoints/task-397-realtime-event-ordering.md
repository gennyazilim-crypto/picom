# Task 397 - Realtime event ordering

## Summary

Prepared the realtime message path to tolerate duplicate and out-of-order events without changing the Picom desktop UI.

## Changes

- Added a bounded realtime event ordering guard in `src/services/supabase/realtimeService.ts`.
- Added deterministic event ID creation for current Supabase row-change payloads.
- Routed message INSERT, UPDATE, soft-delete UPDATE, and DELETE events through the ordering guard.
- Treated soft-delete UPDATE payloads as `message:delete` for ordering decisions.
- Added a local state safety guard so older non-delete upserts do not revive an already deleted message.
- Documented the current foundation and future per-channel sequence-number path.
- Added a smoke test for the ordering foundation.

## Verification

Commands to run:

```powershell
npm run realtime:ordering:smoke
npm run typecheck
npm run build
```

Manual verification:

1. Run Picom in Supabase mode with two desktop windows.
2. Send, edit, and delete messages in one window.
3. Confirm the second window receives updates without duplicate messages.
4. Confirm a deleted message does not reappear after reconnect.

## Known limitations

- Durable cross-session ordering still needs server-provided message sequence numbers.
- Reaction event ordering will reuse this metadata shape when reaction realtime events are fully server-backed.
