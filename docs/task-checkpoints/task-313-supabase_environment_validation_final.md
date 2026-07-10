# Task 313 - Supabase environment validation final

## Completed

- Added executable local, staging/beta, and production Supabase environment contracts.
- Kept local development in safe mock mode while requiring public URL and anon/publishable key for staging and production.
- Added precise runtime rejection for missing, malformed, insecure, credential-bearing, or service-role-like renderer configuration.
- Verified the Electron renderer/runtime contains no service-role variable references.
- Documented the empty service-role placeholder only in the Supabase Edge Function environment example.
- Added checks that real environment files are not tracked by Git and examples do not contain secret-like values.

## Validation commands

- `npm run supabase:env:validate`
- `npm run env:smoke`
- `npm run env:placeholders:check`
- `npm run secrets:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Remaining deployment verification

Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are accepted for the renderer. Hosted
credentials, remote project connectivity, and RLS behavior still require staging and deployment tests.
