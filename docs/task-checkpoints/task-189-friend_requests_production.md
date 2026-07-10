# Task 189 Checkpoint: Friend Requests Production

- Added RPC-only send, accept, decline, cancel, and remove lifecycle.
- Enforced recipient privacy, bidirectional block state, duplicate prevention, cooldown, and existing server-side relationship rate limits.
- Added metadata-only realtime friend notifications.
- Connected FriendsView to production service results, including remove and block actions.
- Synced the Privacy & Safety friend-request preference to `profiles.friend_request_privacy` in Supabase mode.
- Preserved mock mode and existing desktop layouts.

Validation: `npm run friends:production:smoke`, `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.
