# Task 186 Checkpoint - Typing Indicator via Broadcast

## Completed

- Added `useSupabaseTypingBroadcast` for active-channel typing events.
- Uses Supabase Realtime broadcast events, not database rows.
- Composer sends throttled typing start events while the user types.
- Composer sends typing stop on blur, send, empty text, or unmount cleanup.
- MessageList shows a compact desktop typing indicator under the message list.
- Mock mode stays quiet because broadcast is only enabled for Supabase data source.

## Manual verification

1. Run Picom in Supabase mode in two desktop windows.
2. Open the same community/channel in both windows.
3. Type in window A without sending.
4. Confirm window B shows a typing indicator.
5. Stop typing or blur the composer.
6. Confirm the indicator clears after the stop event or timeout.
7. Send the message and confirm the typing indicator clears.

## Notes

- This task does not persist typing state to Postgres.
- Typing events intentionally do not include message content.
- Broadcast payloads include only user id, display name, and boolean typing state.