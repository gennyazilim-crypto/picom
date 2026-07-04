# Task 184 Checkpoint - Prevent Duplicate Optimistic Messages

## Completed

- Added optional `clientMessageId` to the MVP `Message` type.
- Local append and realtime upsert now compare by:
  - server message id
  - `clientMessageId`
- The send path passes its generated `clientMessageId` into local message state.
- Realtime INSERT/UPDATE handlers pass Supabase `client_message_id` into local state.
- If a realtime echo and a local send confirmation arrive out of order, the existing message is updated instead of duplicated.

## Manual verification

1. Run Picom in Supabase mode.
2. Send a message while another window is subscribed to the same channel.
3. Confirm the sender window shows only one copy.
4. Confirm the receiver window shows only one copy.
5. Send several messages quickly and confirm ordering remains stable.

## Notes

- The app currently sends after the Supabase mutation returns; this task prepares the state layer for stronger optimistic sending later.
- No visual layout changes were made.