# Member-only community access test

Task 137 documents a repeatable RLS verification for member-only community access.

## Purpose

Confirm that Supabase RLS prevents users from reading communities, channels, and messages unless they are members of the relevant community.

## Test file

Use:

```text
supabase/tests/member_only_community_access.sql
```

The script is a transaction-wrapped SQL checklist. Replace placeholder UUID values before running it against a local Supabase database.

## Expected results

- A member user can select their community row.
- A member user can select visible channels in that community.
- A member user can select messages from visible channels.
- An outsider user receives no rows for the same community.
- An outsider user receives no channel rows for that community.
- An outsider user receives no messages for that community.
- Private channel rows remain hidden from non-owner members under the current conservative MVP policy.

## Preconditions

1. Supabase migrations have been applied.
2. Seed data exists.
3. At least one target community has one member user and one outsider user.
4. The target community has at least one public text channel.

## Manual steps

1. Start local Supabase or connect to a safe development database.
2. Apply migrations and seed data.
3. Copy real UUIDs into `supabase/tests/member_only_community_access.sql`.
4. Run the SQL inside Supabase SQL Editor or `psql`.
5. Confirm the expected rows/no rows described above.

## Security notes

This test focuses on read isolation. It should be run again after any policy changes for communities, community members, channels, or messages.

Do not run this against production with placeholder values. Use local or staging-only test users.