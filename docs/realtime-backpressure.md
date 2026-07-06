# Realtime Backpressure Policy

Picom uses Supabase Realtime for MVP message updates, typing indicators, and presence. Desktop clients must remain responsive even when realtime events arrive in bursts or reconnect loops happen.

## Goals

- Prevent realtime event floods from freezing the Electron desktop UI.
- Keep typing and presence updates lightweight.
- Preserve core message delivery while degrading low-priority signals first.
- Avoid duplicate renders and duplicate message updates.

## Backend policy placeholder

High-volume realtime events should be bounded:

| Event type | Policy |
| --- | --- |
| Typing | Coalesce and throttle per user/channel. Drop stale typing events. |
| Presence | Debounce track/update calls. Drop stale presence snapshots. |
| Reactions | Rate limit bursts per user/message. Merge counts server-side where practical. |
| Message sends | Enforce existing rate limits/slow mode/idempotency. |
| Webhook/bot placeholders | Rate limit at source before publishing realtime events. |

If excessive events arrive, backend should queue, coalesce, or reject with a clear error rather than letting clients render unbounded bursts.

## Frontend policy

Implemented safeguards:

- Typing broadcasts use `REALTIME_TYPING_THROTTLE_MS` and `shouldThrottleRealtimeSend()`.
- Presence track calls use `REALTIME_PRESENCE_TRACK_THROTTLE_MS` to avoid focus/online/visibility event bursts.
- Presence maps avoid state updates when snapshots are unchanged.
- Message realtime foundations already deduplicate event IDs/client message IDs.

Future safeguards:

- Batch low-priority UI updates during very large reaction/presence bursts.
- Drop stale presence events by sequence/timestamp if backend exposes one.
- Render only visible message-list windows once virtualization is active.

## Degradation order

When under pressure, degrade in this order:

1. Typing indicators.
2. Presence freshness.
3. Reaction animations/count refresh frequency.
4. Non-critical notification/inbox updates.
5. Realtime connection itself, with API fetch fallback if available.

Never degrade permission checks, RLS, or private channel visibility.

## Operational signals

Watch for:

- Realtime reconnect loops.
- Typing event send rate spikes.
- Presence track rate spikes.
- Renderer long tasks after reconnect.
- Duplicate realtime message IDs.
- Desktop memory growth after long sessions.

## User-facing behavior

- If realtime disconnects, show the existing reconnecting/degraded state.
- Keep message sending recoverable.
- Do not block composer input because typing/presence is throttled.
- Prefer stale presence over freezing the app.

## Related files

- `src/services/supabase/realtimeService.ts`
- `src/hooks/useSupabaseTypingBroadcast.ts`
- `src/hooks/useSupabasePresenceChannel.ts`
- `docs/realtime-scaling.md`
- `docs/slo.md`
