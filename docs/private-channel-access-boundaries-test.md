# Private channel access boundaries test

Task 138 documents a repeatable RLS verification for private channel boundaries.

## Purpose

Confirm that private channel rows and their messages do not leak to normal members or outsiders.

## Current MVP rule

Private channels are visible to community owners only. Role-based private channel permissions are intentionally deferred until the role/channel permission tasks.

## Test file

Use:

```text
supabase/tests/private_channel_access_boundaries.sql
```

The script is transaction-wrapped and uses placeholder UUIDs. Replace placeholders with local/staging seed data before running.

## Expected results

- Owner user can select the private channel row.
- Owner user can select messages in the private channel.
- Non-owner community member can select public channel rows.
- Non-owner community member cannot select the private channel row.
- Non-owner community member cannot select messages in the private channel.
- Outsider user cannot select public/private channels in the community.
- Outsider user cannot select messages in either channel.

## Manual steps

1. Apply migrations locally.
2. Ensure a target community has one public channel and one private channel.
3. Identify owner, non-owner member, and outsider test users.
4. Replace placeholders in `supabase/tests/private_channel_access_boundaries.sql`.
5. Run the SQL in Supabase SQL Editor or `psql`.
6. Compare row/no-row results with the expected results above.

## Security notes

This test should be repeated whenever `public.can_view_channel()`, channel RLS, message RLS, attachment RLS, search, or realtime room-join logic changes.