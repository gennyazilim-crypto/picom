# Task 126 checkpoint - Connect login/register to Supabase Auth

## Completed

- Confirmed login/register UI uses centralized `authService`.
- Added Supabase Auth trigger to create profile rows for new email/password users.
- Updated smoke test migration checklist.
- Documented frontend flow, database trigger behavior, security notes, and test steps.

## Changed files

- `supabase/migrations/20260704001300_auth_profile_trigger.sql`
- `scripts/supabase-schema-smoke-test.mjs`
- `docs/login-register-supabase-auth.md`
- `docs/task-checkpoints/task-126-login-register-supabase-auth.md`

## Verification

- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

No secrets were added. Passwords and tokens remain outside logs and public profile rows.