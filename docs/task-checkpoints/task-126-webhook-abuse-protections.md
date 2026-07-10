# Task 126 - Webhook Abuse Protections

## Result

Completed. Incoming webhook requests now enforce JSON MIME, a 16 KiB pre-parse byte limit, an object-only payload, and a strict `content`-only field allowlist. Existing atomic rate limiting, hashed one-time tokens, revocation, message bounds, idempotency, permission rechecks, disabled state, and content-free audit behavior remain intact.

## Changed files

- `supabase/functions/webhook-message/index.ts`
- `docs/webhooks/abuse-protections.md`
- `docs/task-checkpoints/task-126-webhook-abuse-protections.md`

## Verification

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run supabase:smoke`
- `npm run build`

Live rejected-payload/rate-limit tests remain a staging gate because Supabase CLI is unavailable locally. Spam classification is intentionally documented as a privacy-preserving placeholder, not presented as implemented.
