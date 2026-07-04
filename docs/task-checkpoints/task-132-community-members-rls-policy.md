# Task 132 checkpoint - Community members RLS policy

## Completed

- Added `public.is_community_owner(target_community_id uuid)` helper.
- Added member select/insert/update/delete RLS policies.
- Granted authenticated users only RLS-governed table permissions.
- Updated smoke test migration checklist.
- Documented policy behavior and test steps.

## Changed files

- `supabase/migrations/20260704001700_community_members_rls.sql`
- `scripts/supabase-schema-smoke-test.mjs`
- `docs/community-members-rls-policy.md`
- `docs/task-checkpoints/task-132-community-members-rls-policy.md`

## Verification

- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

Membership rows are security-sensitive and now protected by owner/member scoped policies.