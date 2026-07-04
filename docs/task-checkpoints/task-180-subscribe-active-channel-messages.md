# Task 180 Checkpoint - Subscribe to Active Channel Messages

## Status

Implemented by the realtime hook introduced in Task 179.

## Current behavior

- `App.tsx` passes the current `activeCommunity.id` and `activeChannel.id` into `useSupabaseMessageRealtime`.
- The hook subscribes to `public.messages` changes for the active channel.
- When the active channel changes, React cleans up the previous Supabase channel subscription and creates a new one.
- Incoming message events are ignored unless they match the currently active community and channel.
- Local state applies events idempotently by message id, preventing duplicate realtime echo messages.

## Manual verification

1. Run the app in Supabase mode in two desktop windows.
2. Open the same community/channel in both windows.
3. Send a message in window A and confirm it appears in window B.
4. Switch window B to a different channel.
5. Send another message in the original channel from window A.
6. Confirm window B does not show that message until switching back or fetching that channel.
7. Switch window B back and confirm the active-channel fetch/realtime path remains stable.

## Notes

- This task intentionally does not add presence, typing, or notifications.
- The active-channel subscription uses the authenticated Supabase client and does not bypass RLS.
- No UI layout changes were needed.