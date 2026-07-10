# Blocking and Privacy Enforcement

## User experience

- Messages authored by a blocked community member remain as a compact collapsed marker so channel chronology is not misleading; message body, attachments, reactions, and reply actions are not rendered.
- Mention Feed items and followed-user stories authored by blocked users are excluded before rendering. Popular, followed, suggested, and onboarding lists already exclude blocked IDs.
- Direct-message entry points refuse blocked users, existing local conversations are removed when a block is applied, and backend DM RPCs recheck the bidirectional block relation.
- Friend requests are rejected by backend policy when either user has blocked the other.

## Backend enforcement

`block_user` is the only renderer-accessible write path. It atomically inserts the block and removes friendships, pending requests, and follow edges. `unblock_user` only removes a block owned by the authenticated user. Direct table writes are revoked and relationship rate limiting covers block changes.

`list_blocked_users` returns only safe display metadata for the authenticated blocker. No messages, credentials, tokens, headers, IP addresses, or private profile content are recorded.

## Manual checklist

1. Block a member from the profile popover and verify their channel messages collapse.
2. Verify their Mention Feed cards, stories, people suggestions, and DM conversation disappear.
3. Verify opening a new DM or sending a friend request is rejected in both directions.
4. Open Settings > Privacy & Safety, verify the block entry, then unblock and confirm content becomes eligible again.
5. In two Supabase sessions, verify direct table writes fail and RPC behavior matches RLS.
