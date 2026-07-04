# Task 141 checkpoint - Auth and RLS integration test

## Completed

- Added a static Auth/RLS integration check script.
- Documented the manual Supabase Auth + RLS integration test flow.
- Included session-expiry behavior expectations.
- Added sensitive snippet scanning for key Auth/RLS files.

## Changed files

- `scripts/auth-rls-integration-check.mjs`
- `docs/auth-rls-integration-test.md`
- `docs/task-checkpoints/task-141-auth-rls-integration-test.md`

## Verification

- `npm run supabase:smoke`
- `node scripts/auth-rls-integration-check.mjs`
- `npm run typecheck`
- `npm run build`

## Notes

This check is intentionally static because Supabase CLI is not installed in the current local environment. The manual flow documents the runtime test path once local Supabase is available.