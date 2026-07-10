# Rate Limiting and Abuse Hardening

## Result

Picom now has a fixed, user-scoped Postgres action limiter for high-volume authenticated mutations and LiveKit token issuance. Webhook delivery retains its independent backend-only atomic limiter. Renderer services normalize provider/DB `429` and `RATE_LIMITED` responses to safe recovery copy.

Rate limiting reduces abuse and instability; it does not replace authentication, RLS, permission checks, validation, moderation, quotas, malware scanning, or incident response.

## Server-side action limits

Initial thresholds require staging load tuning:

| Action | Operations | Limit/window | Enforcement |
| --- | --- | --- | --- |
| `message_send` | message inserts | 30 / 60 seconds | Postgres trigger |
| `attachment_metadata` | attachment metadata inserts | 20 / 5 minutes | Postgres trigger |
| `reaction_write` | reaction add/remove | 120 / 60 seconds | Postgres trigger |
| `relationship_write` | follow/unfollow and friend-request mutations | 30 / 60 seconds | Postgres trigger |
| `feed_interaction` | saved-message add/remove | 120 / 60 seconds | Postgres trigger |
| `livekit_token` | voice/screen token requests | 10 / 60 seconds | Edge Function + Postgres limiter |
| webhook delivery | inbound webhook messages | 30 / 60 seconds per webhook | Existing backend limiter |

`user_action_rate_limits` stores a bounded counter per user/action, window timestamps, denial count, and last denial time. It stores no raw IP, credential/token/hash, authorization header, message content, request body, attachment path, or private data. Authenticated clients cannot read/mutate the table, and callers cannot choose thresholds.

Trusted service-role operations with no end-user `auth.uid()` require their own credential-specific limiter. Existing webhook delivery already has one.

## Authentication

Supabase Auth is the authoritative login/register limiter and returns HTTP 429 when exceeded. Production must review Authentication rate limits, enable appropriate CAPTCHA/Turnstile for signup/sign-in/reset, configure approved SMTP quotas, use non-enumerating errors, and monitor privacy-safe failure aggregates. Never trust/forward an IP header supplied by the Electron renderer.

`authService` maps 429 to `AUTH_RATE_LIMITED` and generic wait/retry copy. Passwords and credential payloads are never logged. Official reference: [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).

## Messages

- DB trigger applies even when UI throttling is bypassed.
- RLS still enforces author, membership, channel visibility/type, and send permission.
- `clientMessageId`, idempotency, slow mode, and offline queue behavior remain separate controls.
- Renderer maps denial to stable `RATE_LIMITED` and preserves recoverable text.
- Message bodies must not enter rate-limit/security logs.

## Uploads

Current controls include MIME/size/content checks, private Storage RLS, pending ownership, metadata limit, scan/quarantine placeholders, and cancel/retry.

**Production blocker:** the desktop uploads object bytes directly to Supabase Storage before metadata creation. The metadata trigger cannot stop a modified authenticated client from repeatedly uploading pending objects. Production uploads require a trusted short-lived upload grant/Edge Function or provider/gateway quota, per-user/tenant byte/object/concurrency limits, send-permission check, and orphan cleanup. Object size/bucket limits must be server/provider enforced. Never log file bytes, signed URLs, private paths, or tokens.

## Reactions, follows, friends, and Mention Feed

- Reaction insert/delete uses the DB user bucket plus message visibility RLS.
- Follow/unfollow and friend-request writes share a relationship bucket plus participant/self RLS.
- Saved-message add/remove, the current Supabase-backed feed persistence action, uses a feed bucket and rechecks message visibility.
- Local filters, read state, story seen, and mock interactions do not consume server resources.
- Future server-backed views/comments/feed ranking require idempotency/coalescing and endpoint-specific limits.
- No feed/message text belongs in abuse events.

## Webhooks and bots

Webhook delivery already performs backend-only token hash/revocation/permission checks, fixed 30/min bucket, atomic insert, audit, and safe 429/`Retry-After`. Before public use add gateway/network-risk, per-community/channel global caps, idempotency/replay, mention/payload limits, and anomaly controls without revealing token validity.

Bot API remains disabled. Credential `rateLimitPerMinute` metadata is not enforcement. Public bot routes require backend token/scopes/RLS, bot/app/tenant/channel/action buckets, idempotency, event backpressure/retries, revoke/kill switch, audit/abuse signals, and no renderer-held long-term token.

## Edge Functions

| Function class | Current control | Remaining requirement |
| --- | --- | --- |
| `livekit-token` | Auth, channel RLS, 10/min user bucket, safe 429 | Tenant/global cap, load tuning, anomaly monitoring |
| `webhook-message` | Disabled gate, backend token, 30/min webhook bucket | Gateway/global caps and activation review |
| `user-data-export` | Auth and recent-job cooldown | Per-user/day, job/storage/egress caps |
| deletion/invite/moderation/notification/validate-file | Auth/permission/validation varies | Fixed user/tenant/gateway limits before high-volume production use |
| `health`/`client-config` | Safe public response intent | CDN/gateway limits/cache and no sensitive detail |

Use body/time limits, CORS/method allowlists, safe errors/request IDs, and redacted metrics. In-memory serverless counters are not authoritative because instances restart/scale.

## LiveKit token requests

The endpoint authenticates first, consumes `livekit_token` before using signing secrets, verifies community/channel via user-scoped Supabase RLS, derives identity/room server-side, and returns safe 429 with bounded `Retry-After` without issuing a token. Never log the token, API secret/key, Authorization header, room grant, or private metadata.

## Abuse signals and retries

Store only action category, justified stable IDs, timestamp, denied count, request ID, severity/outcome, and privacy-approved network hash. Exclude bodies, bytes, filenames/paths, credentials/tokens/hashes/headers/cookies, signed URLs, SAML assertions, and LiveKit grants. A limit hit is not automatically malicious.

Clients respect `Retry-After`, use bounded jittered backoff only for safe/idempotent operations, and do not auto-retry login/register/uploads/unsafe POST. Local throttle/debounce is UX, never enforcement.

## Monitoring and live tests

Track allowed/denied rates, bucket contention, 429s, false positives, upload bytes/orphans, webhook auth failures, and LiveKit token-to-join conversion without content/secrets. Threshold changes require review, canary, and rollback.

Before connected release:

1. Run pgTAP in disposable Supabase.
2. Send threshold+1 concurrent calls per action and verify atomic denial, second-user isolation, reset, and `Retry-After`.
3. Bypass UI through direct REST and verify trigger + RLS.
4. Verify webhook/user buckets are isolated and LiveKit denial issues no token.
5. Test configured Auth provider limits/CAPTCHA.
6. Complete trusted Storage upload-grant/quota architecture and abuse test.
7. Verify no secret/content in counters, Edge logs, desktop logs, audit, or diagnostics.
8. Load test legitimate rapid chat/reaction/reconnect behavior.

Supabase CLI is currently unavailable locally, so structural smoke does not replace live concurrency/provider tests.

