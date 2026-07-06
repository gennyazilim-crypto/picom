# Supabase QA Gate

`npm run qa:supabase` runs the local Supabase schema and API-mode regression checks that do not require production secrets.

## Command

```powershell
npm run qa:supabase
```

## Included checks

- `npm run supabase:smoke`
- `npm run supabase:rls:smoke`
- `npm run supabase:api-regression`

## Notes

- The schema smoke test may warn when the Supabase CLI is not installed.
- The RLS smoke test validates local SQL test coverage without the CLI and warns when real pgTAP execution is skipped.
- That warning is non-blocking unless you need the optional local reset flow.
- Run `npm run supabase:rls:test` after installing Supabase CLI to execute the real local RLS checks.
- This gate does not require Supabase service-role keys, LiveKit secrets, signing keys, auth tokens, or passwords.

## Manual QA

- Run this before Supabase-mode UI work.
- Run this before RLS migrations are reviewed.
- Pair this with manual login/register/message tests against a local or staging Supabase project.
