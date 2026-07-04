# Task 106 - Database migration baseline

Picom now has a Supabase migration baseline for the MVP chat schema.

## Migration

- `supabase/migrations/20260704000100_baseline.sql`

## Tables

- `profiles`
- `communities`
- `roles`
- `community_members`
- `channel_categories`
- `channels`
- `messages`
- `attachments`
- `message_reactions`
- `read_states`

## Security posture

- RLS is enabled on all app tables.
- No policies are added in this baseline; follow-up tasks should add least-privilege policies.
- Client-side Supabase access must use anon key only.
- Privileged work must be handled by Edge Functions or trusted backend code.

## Indexes

Baseline indexes cover:

- Community membership lookups.
- Channel/category ordering.
- Message pagination by channel and timestamp.
- Attachment lookup by message.
- Reaction lookup by message.
- Read state lookup by user/channel.

## Manual verification

1. Start local Supabase when CLI support is available.
2. Apply the migration.
3. Confirm all tables exist.
4. Confirm RLS is enabled on every table.
5. Confirm no service role keys are used in the Electron renderer.
