# Message reactions table schema

Task 115 hardens `public.message_reactions`, the table used by Picom message reaction rows.

## Table purpose

Message reactions let users add compact emoji feedback to chat messages while keeping the MessageList premium and lightweight.

## Baseline fields

- `id`: UUID primary key.
- `message_id`: message reference, cascades with message deletion.
- `user_id`: reacting profile reference.
- `emoji`: reaction value.
- `created_at`: creation timestamp.
- Unique triplet: `message_id`, `user_id`, and `emoji`.

## Schema hardening added

- Emoji values must be 1 to 64 characters.
- Emoji values cannot contain control characters.
- `idx_reactions_message_emoji` supports grouped reaction counts per message.
- `idx_reactions_user_created_at` supports user reaction history and cleanup/debug queries.

## RLS and security notes

RLS is enabled in the baseline migration. Future policies must ensure users can only read reactions for messages they can view and only add/remove their own reactions where they have access to the channel.

The unique reaction triplet prevents duplicate rows for the same user emoji on the same message, but RLS remains the source of truth for access control.

## Test steps

1. Apply migrations in a local Supabase project.
2. Insert a reaction with a normal emoji value; it should succeed.
3. Insert the same `message_id`, `user_id`, and `emoji` again; it should fail because of the baseline unique constraint.
4. Try an empty emoji or control-character value; it should fail.
5. Query reaction counts by `message_id` and `emoji` to confirm grouped reaction lookup is efficient.