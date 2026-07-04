# Task 122 checkpoint - Supabase Auth email/password

## Completed

- Added local Supabase config for email/password Auth.
- Enabled refresh token rotation and local Inbucket email testing.
- Documented renderer-safe environment variables, production review notes, and test steps.
- Updated the schema smoke test to require `supabase/config.toml`.

## Changed files

- `supabase/config.toml`
- `scripts/supabase-schema-smoke-test.mjs`
- `docs/supabase-auth-email-password.md`
- `docs/task-checkpoints/task-122-supabase-auth-email-password.md`

## Verification

- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

No secrets were added. Production email confirmation and SMTP behavior must be reviewed before launch.