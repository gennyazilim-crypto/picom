# Task 202 - Secure Edge Functions with Supabase JWT

## Scope

- Added shared `requireSupabaseUser()` helper for Edge Functions.
- Updated protected functions to verify the caller with Supabase Auth instead of checking only for an auth header.
- Documented JWT security, RLS implications, environment variables, and manual test steps.

## Runtime impact

- Existing desktop UI behavior is unchanged.
- `health` remains the only intentionally unauthenticated function.
- No service-role credentials or secrets were added.

## Verification

- Run `npm run supabase:smoke`.
- Run `npm run typecheck`.
- When Supabase CLI is available, call protected functions with missing, invalid, and valid bearer tokens.
