# Task 130 checkpoint - Profiles RLS policy

## Completed

- Added `public.can_view_profile(profile_id uuid)` helper.
- Added select/insert/update profile RLS policies.
- Granted authenticated users only the required table permissions.
- Updated smoke test migration checklist.
- Documented policy behavior and test steps.

## Changed files

- `supabase/migrations/20260704001500_profiles_rls.sql`
- `scripts/supabase-schema-smoke-test.mjs`
- `docs/profiles-rls-policy.md`
- `docs/task-checkpoints/task-130-profiles-rls-policy.md`

## Verification

- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

RLS is the source of truth. Frontend protected state is only UX gating.