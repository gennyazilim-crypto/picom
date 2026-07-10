# Direct Messages Production Backend

Picom direct messages are private one-to-one conversations with exactly two participants. No group DM, public conversation, or cross-community membership assumption is supported.

## Access, block, and privacy

Conversation/message RLS requires current membership and rechecks bilateral block state. Conversation creation and every send also apply the recipient's `dm_privacy` preference: everyone, friends, or no one. Friend-only access uses the accepted friendship table. A database trigger rejects a third participant.

## Writes and realtime

Message sends use an idempotent security-definer RPC with a bounded `clientMessageId`; direct table inserts are revoked. Edit/delete remain author-only RLS updates. Realtime subscriptions are created only after membership verification and removed on conversation changes/unmount. Notifications contain no private message body.

## Desktop loading

The desktop loads at most 50 conversations and the latest 100 messages per conversation. Conversation selection records a read timestamp. Supabase mode uses backend models; mock mode remains available for local QA.

## No group DM

Only one-to-one conversations are approved. Group creation, participant invites, title/avatar fields, ownership, and group moderation are intentionally absent.

## access-boundary checklist

1. User A cannot select User B/C's conversation or messages.
2. A third member insert is rejected.
3. Either-side block prevents creation, reading through membership helper, sending, and realtime subscription.
4. `friends` privacy rejects non-friends; `no_one` rejects new and existing sends.
5. Duplicate client IDs return the prior message rather than inserting twice.
6. Realtime subscriptions stop after logout/conversation removal.
