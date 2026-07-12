# Task 619 Checkpoint - Hosted Supabase, Realtime, and Edge Functions

## Result

- Local V1 scope and security contracts: **PASS**.
- Hosted staging execution: **BLOCKED**.
- Release blocker status: RB-01, RB-02 and RB-03 remain open.

## Implemented

- Added a V1-only RLS/Storage/Realtime actor matrix and private profile/media fixtures.
- Ensured authenticated matrix actors set the Realtime JWT before private joins.
- Kept deny-by-default community, channel and participant-only DM topic policies.
- Reduced Edge scope to non-placeholder V1 functions.
- Added CORS, JWT, method, body-limit and rate-limit hosted probes.
- Replaced Full-MVP/Meeting hosted validation with a protected V1 workflow.
- Added a contract rejecting hidden-feature and provider-secret coupling.

## Evidence limitation

The dashboard confirms a dedicated staging project exists. The machine has no Supabase CLI/access token or hosted synthetic credentials, and GitHub has no `hosted-staging` environment. No hosted matrix ran, so this checkpoint does not claim hosted PASS.

## Still required

- staging migration parity
- all actor/RLS/Storage checks
- private Presence/typing/room/DM two-client checks
- deployed V1 Edge boundary checks
- immutable workflow URL and commit SHA

See `docs/v1-hosted-supabase-closure.md`.

## Local commands

- `npm ci` - PASS, zero reported vulnerabilities
- `node scripts/supabase-migration-integrity.mjs` - PASS, 188 ordered BOM-free migrations
- `node scripts/v1-hosted-supabase-contract.mjs` - PASS
- `node scripts/edge-functions-release-scope-smoke.mjs` - PASS after correcting the contract to inspect the existing bounded-body and JWT helpers separately
- Realtime staging contract, Presence integration and deduplication smokes - PASS
- hosted runners without `--run` - safe preflight PASS; no network call
- `npm run typecheck` - PASS
- `npm run build` - PASS
