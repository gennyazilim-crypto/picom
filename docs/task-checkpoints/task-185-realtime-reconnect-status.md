# Task 185 Checkpoint - Realtime Reconnect Status

## Completed

- `useSupabaseMessageRealtime` now returns a typed connection status:
  - `idle`
  - `connecting`
  - `connected`
  - `reconnecting`
  - `disconnected`
- Supabase channel subscription states are mapped into user-safe UI states.
- `CHANNEL_ERROR` and `TIMED_OUT` move the UI into `reconnecting` and write a redacted warning log.
- `SUBSCRIBED` moves the UI into `connected`.
- ChatHeader now displays a compact realtime status pill without changing the desktop layout.
- Mock mode hides the pill through the `idle` state.

## Manual verification

1. Run Picom in mock mode and confirm no realtime pill is shown.
2. Run Picom in Supabase mode and open a text channel.
3. Confirm the ChatHeader status moves from `Connecting` to `Live`.
4. Temporarily interrupt the network or Supabase realtime connection.
5. Confirm the status changes to `Reconnecting` or `Disconnected` without crashing.
6. Restore the connection and confirm messages still work after resubscription.

## Notes

- This task does not implement a full reconnect queue or offline send queue.
- The status is intentionally subtle and uses existing design tokens.