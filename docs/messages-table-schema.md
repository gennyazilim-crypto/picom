# Messages table schema

Task 113 hardens `public.messages`, the central table for text chat records in Picom.

## Table purpose

Messages power the ChatMain message list, local send flow, future Supabase Realtime broadcasts, search, reactions, attachments, and read-state calculations.

## Baseline fields

- `id`: UUID primary key.
- `community_id`: owning community reference.
- `channel_id`: channel reference.
- `author_id`: profile reference.
- `body`: message text, empty when an attachment-only message is allowed.
- `created_at`: creation timestamp.
- `edited_at`: optional edit timestamp.
- `deleted_at`: optional soft-delete timestamp.

## Schema hardening added

- `client_message_id`: optional client-generated id for optimistic send reconciliation.
- Message bodies are limited to 4000 characters.
- Client message ids are limited to 120 characters.
- Edit and delete timestamps cannot be earlier than creation time.
- A trigger prevents messages from pointing to a channel in a different community.

## Indexes added

- `messages_author_client_message_unique` prevents duplicate persisted messages for the same author/client id.
- `idx_messages_community_channel_created_at` supports scoped channel pagination.
- `idx_messages_channel_visible_created_at` supports visible message list queries.
- `idx_messages_client_message_id` supports optimistic reconciliation lookups.

## RLS and security notes

RLS is enabled in the baseline migration. Future policies must ensure only members who can view a channel can read its messages, only permitted members can send messages, and private-channel messages are never leaked through direct table reads or search.

The `client_message_id` uniqueness index is not a security boundary. It only reduces duplicate sends from retries, reconnects, or double-clicks.

## Test steps

1. Apply migrations in a local Supabase project.
2. Insert a message in a channel whose `community_id` matches the message; it should succeed.
3. Try inserting a message with a channel from another community; it should fail.
4. Try inserting two messages from the same author with the same `client_message_id`; the second insert should fail.
5. Query messages by `channel_id` ordered by `created_at desc` to confirm pagination shape remains efficient.