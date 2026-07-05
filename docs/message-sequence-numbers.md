# Message sequence numbers

Picom now prepares stable per-channel message ordering with an optional `public.messages.sequence` column.

## Goals

- Preserve user-visible message order during rapid sends.
- Prepare future offline sync and cursor pagination.
- Keep existing `created_at` ordering as a safe fallback.
- Avoid duplicate sequence values during concurrent sends in the same channel.

## Database behavior

Migration `20260704002500_message_sequence_numbers.sql`:

- Adds nullable `sequence bigint` to `public.messages`.
- Backfills existing messages with `row_number()` per channel ordered by `created_at asc, id asc`.
- Adds `messages_sequence_positive`.
- Adds `messages_channel_sequence_unique` on `(channel_id, sequence)` where sequence is not null.
- Adds `idx_messages_channel_sequence_created_at`.
- Adds `public.assign_message_sequence()`.
- Adds `trg_messages_assign_sequence` before insert.

The trigger uses `pg_advisory_xact_lock(hashtext(new.channel_id::text))` to serialize sequence assignment per channel inside the transaction.

## Frontend behavior

- `MessageSummary`, shared `MessageDTO`, and local `Message` can carry `sequence`.
- Supabase message list/send selects include `sequence`.
- Message display sorting uses sequence when both compared messages have it.
- If sequence is missing, sorting falls back to `createdAt` and then id.
- Mock mode continues to work because sequence is optional.

## Pagination behavior

The current `before` cursor remains timestamp-based for compatibility. Once sequence has been deployed everywhere, pagination can move to a compound cursor:

- `sequence`
- `created_at`
- `id`

## Manual verification

1. Apply Supabase migrations to a clean database.
2. Seed or send several messages in one channel.
3. Confirm `sequence` starts at 1 and increments within that channel.
4. Send messages in two channels and confirm sequences are independent per channel.
5. Open Picom in Supabase mode and confirm message order remains chronological.

## Known limitations

- Existing clients without the migration will fail if they query `sequence`; apply migrations before using Supabase mode.
- Sequence is an ordering aid, not a permission boundary.
- Compound pagination is documented but not yet implemented.
