# Task 29 Checkpoint: Production Environment and Secrets Lockdown

## Scope

- Added a fast environment placeholder safety check.
- Added the check to package scripts and README release guidance.
- Clarified that `.env.production.example` is an inventory, not a renderer env file.
- Added a production secret ownership/rotation matrix.
- Confirmed real `.env.local`, `.env.production`, and environment-local files are ignored.

## Enforced rules

- Server-only names cannot use the `VITE_` renderer prefix.
- CI/server secret placeholders must remain empty in committed examples.
- Supabase anon-key examples must be empty or obvious fake placeholders.
- Common JWT, secret token, private-key, and credentialed database URL patterns are rejected.
- Renderer configuration remains public and depends on RLS/backend authorization.

## Validation

- `npm run env:placeholders:check` - passed.
- `npm run env:smoke` - passed.
- `npm run secrets:smoke` - passed.
- `npm run secrets:ci:smoke` - passed.
- `npm run typecheck` - passed.
- `npm run mock:smoke` - passed.
- `npm run build` - passed with the known non-blocking chunk warning.

## Remaining operational work

- Configure real values only in approved protected CI/provider secret stores.
- Assign named secret owners and rotation dates in the private operations register.
- Run artifact and CI-log inspection against the production candidate.
