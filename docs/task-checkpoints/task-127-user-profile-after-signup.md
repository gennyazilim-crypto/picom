# Task 127 checkpoint - Create user profile after signup

## Completed

- Added backfill migration for missing profile rows from existing Supabase Auth users.
- Documented the trigger/backfill profile creation strategy.
- Updated smoke test migration checklist.

## Changed files

- `supabase/migrations/20260704001400_profile_signup_backfill.sql`
- `scripts/supabase-schema-smoke-test.mjs`
- `docs/user-profile-after-signup.md`
- `docs/task-checkpoints/task-127-user-profile-after-signup.md`

## Verification

- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

No secrets are copied from Auth into public profiles. The migration only uses safe public profile fields.