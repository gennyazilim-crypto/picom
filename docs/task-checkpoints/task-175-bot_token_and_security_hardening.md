# Task 175 checkpoint: Bot token and security hardening

## Result

- Preserved high-entropy token generation and SHA-256 hash-at-rest with explicit algorithm metadata.
- Added atomic production revoke/regenerate RPC; issue failure rolls back revocation.
- Added mock revoke/regenerate support while keeping raw replacement token one-time only.
- Added central logger pattern redaction for unlabelled `picom_bot_...` strings.
- Preserved owner/app-admin plus community-manager authorization, append-only lifecycle audit, and service-role-only action rate limits.
- Added no public Bot API, renderer credential verification, token logs, marketplace, or executable runtime.

## Validation

- `npm run bots:security:test`
- `npm run bots:production:test`
- `npm run logs:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Remaining blockers

- Supabase CLI is unavailable locally, so atomic rotation/RLS/concurrency behavior remains unverified live.
- Trusted gateway authentication with constant-time compare/optional pepper, provisioning/UI wiring, multi-community lifecycle, abuse suspension, monitoring, incident drills and security review remain required.
