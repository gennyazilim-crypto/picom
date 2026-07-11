# Direct Messages Services, Realtime, and Read States

Picom routes every DM operation through `directMessageService`. Renderer components do not query Supabase directly. Mock and Supabase adapters expose the same conversation, message, reaction, attachment, preference, and read-state behavior.

## Loading and pagination

- Conversation summaries load separately from message bodies.
- The active conversation loads at most 100 recent messages initially.
- `getDirectMessagesPage` uses a stable `(created_at, id)` cursor and supports older-page retrieval without offset drift.
- Reply previews, reactions, and attachment metadata are enriched only for the loaded page.
- Shared media has its own participant-protected cursor query.

## Writes and idempotency

- Send uses `send_direct_message_v2` and a stable `clientMessageId`.
- Optimistic and realtime echoes reconcile by server ID or `clientMessageId`.
- Mock sends return the prior successful result when the same client ID is repeated.
- Edit/delete use author-protected RPCs; delete remains a redacted soft delete.
- Attachment retries check existing message URLs before inserting metadata.
- Reaction inserts use the unique message/user/emoji key.

## Realtime lifecycle

One content subscription is attached to the active conversation and is removed when the active conversation changes or the view unmounts. A separate lightweight conversation-list subscription observes summary and current-user read-state changes. The active channel covers message insert/update/delete, reactions, attachments, and participant read cursors. Supabase channel reconnect states are surfaced without creating duplicate React subscriptions, and each subscription has a bounded event deduplication cache.

## Read, mute, and archive

- Opening a conversation clears local unread state and advances the authenticated participant cursor.
- An incoming message in the active DM is marked read through the service.
- `mark_direct_conversation_read_to` prevents a read cursor from moving backward.
- Mute and archive update only the authenticated participant row.
- Archive removes the conversation from the normal list without deleting retained messages.

## Hosted evidence

Run the two-window procedure in `docs/direct-messages-realtime-smoke.md` against a non-production Supabase project after applying migrations. Verify exactly-once optimistic reconciliation, inactive unread increments, active read clearing, reconnect convergence, and subscription cleanup. This hosted evidence must remain BLOCKED when Supabase credentials or CLI access are unavailable; structural smoke tests are not a substitute.
