# Task 131 checkpoint - Communities RLS policy

## Completed

- Added `public.is_community_member(target_community_id uuid)` helper.
- Added community select/insert/update RLS policies.
- Granted authenticated users only required table permissions.
- Updated smoke test migration checklist.
- Documented RLS behavior and test steps.

## Changed files

- `supabase/migrations/20260704001600_communities_rls.sql`
- `scripts/supabase-schema-smoke-test.mjs`
- `docs/communities-rls-policy.md`
- `docs/task-checkpoints/task-131-communities-rls-policy.md`

## Verification

- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

Frontend community switching remains unchanged. RLS now defines which communities can be read in Supabase mode.