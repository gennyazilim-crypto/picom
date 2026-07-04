# Task 189 Checkpoint - Unread State Foundation

## Completed

- Added local channel unread state helpers:
  - `markChannelUnread`
  - `clearChannelUnread`
- Channel unread and mention counters can now be updated through state helpers instead of hardcoded UI only.
- Opening/selecting a channel clears its unread flag and mention count.
- Active channel changes also clear unread state, covering keyboard and command-palette navigation paths.
- Existing `ChannelItem` unread dot and mention badge UI remains unchanged.

## Manual verification

1. Start the app in mock mode.
2. Open a channel that has an unread dot or mention badge.
3. Confirm the unread dot/mention badge clears after selecting the channel.
4. Use command palette or keyboard channel navigation and confirm the active channel is marked read.
5. Confirm no layout changes occur in the CommunitySidebar.

## Notes

- This task creates the local foundation only.
- Persisting read state to Supabase `read_states` is a later task.
- Marking inactive channels unread from background realtime subscriptions can be connected to `markChannelUnread` later.