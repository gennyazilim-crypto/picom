# Task 501 checkpoint

## Completed

- Added authoritative member/kind/channel/private/ban/timeout/permission authorization RPC.
- Reduced token TTL to ten minutes and grants to intent-specific microphone or screen-share sources.
- Added exact-origin CORS, method, JSON content-type, key, participant, and 2 KiB body validation.
- Added safe local security smoke and an opt-in staging allowed/visitor/private matrix runner.
- Documented server-only secrets and deployment sequence without storing values.

## Validation evidence

- `npm run livekit:token:security:smoke` - PASS
- `npm run livekit:smoke` - PASS
- `npm run livekit:token:staging` - BLOCKED report; PASS for no-network/no-secret safety behavior
- `node scripts/edge-functions-staging-contract-test.mjs` - PASS
- `node scripts/secret-exposure-smoke-test.mjs` - PASS
- `npm run typecheck` - PASS
- `npm run mock:smoke` - PASS
- `npm run build` - PASS
- `npm run qa:smoke` - PASS
- `npm run supabase:smoke` - PASS for committed schema structure
- `npm run performance:budget:ci` - PASS

Actual migration push, secret configuration, function deployment, Deno/function serve, allowed-member token issuance, visitor/private denial, and LiveKit server connection remain BLOCKED because the Supabase CLI/staging session, synthetic fixtures, and LiveKit server credentials are unavailable. No deployed success is claimed.
