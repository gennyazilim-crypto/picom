# Task 137 checkpoint - Member-only community access test

## Completed

- Added a manual SQL RLS verification script for member-only community access.
- Documented expected member vs outsider results.
- Kept the test transaction-wrapped and local/staging-oriented.
- Avoided adding production credentials or destructive behavior.

## Changed files

- `supabase/tests/member_only_community_access.sql`
- `docs/member-only-community-access-test.md`
- `docs/task-checkpoints/task-137-member-only-community-access-test.md`

## Verification

- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

Supabase CLI is not currently installed in this environment, so the SQL test is prepared as a manual local/staging verification script rather than an automatically executed database reset test.