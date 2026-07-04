# Task 187 Checkpoint - Presence Channel for Online Status

## Completed

- Added `useSupabasePresenceChannel` using Supabase Realtime Presence.
- Presence is scoped to the active community.
- The current user is tracked with safe payload fields:
  - user id
  - display name
  - status
  - online timestamp
- Active community rendering overlays online status for users currently present.
- MemberSidebar and profile/member surfaces receive the displayed community with live online status.
- No database writes are used for MVP presence.

## Manual verification

1. Run Picom in Supabase mode in two desktop windows.
2. Log in as users in the same community.
3. Confirm online users show as online in the member list.
4. Close one window and confirm presence clears after Supabase sync.
5. Switch communities and confirm presence is scoped to the active community.

## Notes

- Presence payloads do not include tokens, cookies, auth headers, or message content.
- Presence is a live overlay only; it does not persist member status to Postgres.
- More detailed idle/DND synchronization can be handled in later presence tasks.