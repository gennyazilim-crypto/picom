# Task 318 - Edge Functions staging validation

## Result

Hosted execution is **blocked / not run** as of 2026-07-10 because staging deployment configuration,
synthetic Auth credentials, and fixture IDs are unavailable. No network request was made and no credential,
JWT, provider token, URL, or secret was exposed.

## Prepared coverage

- `livekit-token`: JWT, CORS, method, authorized voice-channel binding, identity, and short expiry.
- `accept-invite`: JWT/CORS and typed 501 no-action placeholder.
- `moderation-helper`: JWT/CORS and typed 501 no-action placeholder.
- Missing/malformed JWT denial for all three protected endpoints.
- Static `verify_jwt=true`, shared auth/CORS, and no service-role reference checks.

## Validation

- `npm run edge:staging:preflight`
- `npm run edge:staging:test` - expected blocked until staging values are securely injected.
- `npm run edge:staging:contract:test`
- `npm run livekit:smoke`
- `npm run supabase:smoke`
- `npm run secrets:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

See `docs/edge-functions-staging-validation.md`. A real hosted pass remains a P1 release gate.
