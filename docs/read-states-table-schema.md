# Read states table schema

Task 116 hardens `public.read_states`, the table that tracks per-user channel read markers for unread indicators.

## Table purpose

Read states support desktop sidebar unread dots, channel read markers, and future notification routing. They are per user and per channel.

## Baseline fields

- `id`: UUID primary key.
- `user_id`: profile reference.
- `channel_id`: channel reference.
- `last_read_message_id`: optional message reference.
- `updated_at`: read state update timestamp.
- Unique pair: `user_id` and `channel_id`.

## Schema hardening added

- `idx_read_states_channel_updated_at` supports channel-level read-state lookups.
- `idx_read_states_last_read_message_id` supports message/read marker joins.
- A trigger ensures `last_read_message_id` belongs to the same channel as the read state.

## RLS and security notes

RLS is enabled in the baseline migration. Future policies must ensure users can only read and update their own read states. Community admins should not receive user-specific read-state data unless a separate privacy-reviewed feature is intentionally added.

Read states are not security boundaries. Message/channel RLS must still protect private channel data.

## Test steps

1. Apply migrations in a local Supabase project.
2. Insert a read state for a user/channel with a message from that channel; it should succeed.
3. Try setting `last_read_message_id` to a message from another channel; it should fail.
4. Confirm one read-state row per `user_id` and `channel_id` remains enforced by the baseline unique constraint.
5. Query read states by `channel_id` and `updated_at desc` to verify channel lookup behavior.