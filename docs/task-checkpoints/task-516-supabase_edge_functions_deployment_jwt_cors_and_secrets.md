# Task 516 - Supabase Edge Functions Deployment, JWT, CORS, and Secrets

## Status

Release scope and local contracts are complete. Actual staging deployment and hosted allowed/denied execution are BLOCKED because Supabase CLI/operator staging authorization and required hosted secrets are unavailable.

## Completed

- Inventoried every Edge Function as release public, release authenticated, internal, placeholder, or post-release.
- Removed placeholder functions from release deployment and hosted success evidence.
- Added explicit config for public `client-config` and preserved JWT requirements for protected functions.
- Added exact-origin denial to shared non-cookie CORS handling.
- Added bounded JSON/content-type/key validation for release mutation handlers.
- Completed CORS/JWT/body hardening for LiveKit moderation.
- Added a staging-only deploy script with project-ref equality, secret-name, CLI, and explicit confirmation gates.
- Added a release-only hosted matrix and deterministic scope/security tests.
- Kept provider/service-role/worker secrets server-only and out of responses/logs.

## Exact blocker

The local machine does not have the Supabase CLI and this task has no approved staging project ref, operator login, function secret inventory, or synthetic hosted fixtures. No deployment was attempted and no success was fabricated.

## Validation

Passed locally:

- `node scripts/edge-functions-release-scope-smoke.mjs`
- `npm run edge:staging:contract:test`
- `npm run edge:staging:preflight` (safe preflight; no network request)
- `npm run livekit:token:security:smoke`
- `npm run livekit:smoke`
- `npm run auth:account-deletion:smoke`
- `npm run privacy:data-export:smoke`
- `npm run privacy:data-export:real:test`
- `npm run privacy:account-deletion:real:test`
- `npm run secrets:smoke`
- `npm run secrets:management:smoke`
- `npm run secrets:ci:smoke`
- `npm run supabase:qa`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run qa:smoke`
- `npm run build`

The build completed successfully. Supabase pgTAP execution was skipped by the existing QA gate because the CLI is unavailable; structural RLS validation passed. `node scripts/deploy-release-edge-functions.mjs` reported `BLOCKED` in dry-run mode and made no network connection.
