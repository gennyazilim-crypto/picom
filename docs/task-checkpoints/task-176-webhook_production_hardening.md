# Task 176 checkpoint: Webhook production hardening

## Result

- Moved production create/revoke from direct renderer table mutation to trusted manager-only RPCs.
- Removed authenticated webhook INSERT/UPDATE/DELETE grants and mutation policies.
- Server generates high-entropy token, stores hash only, and returns raw token once.
- Separated one-time token from endpoint URL and removed query-string token acceptance.
- Preserved channel-scoped text-only permission checks, atomic rate limits/idempotency/audit and clear `WEBHOOK` message badge.
- Verified payload path rejects unsupported fields/large/non-text content and renderer uses no unsafe HTML.

## Validation

- `npm run webhooks:production:test`
- `npm run webhooks:foundation:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Remaining blockers

- Supabase CLI is unavailable locally, so live RPC/RLS/rate/idempotency tests remain required.
- Edge deployment secrets/config, load/abuse monitoring, rotation, on-call ownership, incident drill and security review remain open; delivery stays server-flag disabled by default.
