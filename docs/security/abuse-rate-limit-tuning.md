# Abuse rate-limit tuning decision

## Decision

Current server-side thresholds remain unchanged. No representative beta/post-launch allowed/denied/false-positive baseline exists, so changing limits would be guesswork. Public bots/webhooks remain disabled/restricted and uploads still need trusted byte/object quota enforcement.

## Current enforced baseline

| Surface | Current | Tuning evidence required |
| --- | --- | --- |
| Auth | Supabase provider limits/CAPTCHA configuration | valid vs abuse-safe error aggregate, provider quota, reset/email impact; no password/IP log |
| Messages | 30/user/60s DB trigger | rapid legitimate send p95/p99, offline flush, denial/appeal/support and spam rate |
| Attachment metadata | 20/user/300s DB trigger | object+byte+concurrency/orphan rates; metadata alone is insufficient |
| Reactions | 120/user/60s | burst/reconnect duplicates, legitimate p99 and abuse cost |
| Relationships | 30/user/60s | onboarding/follow/friend bursts and harassment/spam reports |
| Feed interactions | 120/user/60s | save/unsave retries and duplicate/idempotent writes |
| LiveKit token | 10/user/60s | token-to-join conversion, reconnect/device switching and denied issuance |
| Webhook | 30/credential/60s | disabled until credential/channel/community/global caps and load/security review |
| Bots | metadata 60/min; backend-only limiter foundation | disabled public API; per credential/app/community/channel/action costs before launch |
| Invites/exports/deletion | endpoint-specific cooldown/foundations | add backend user/community/network-risk caps before high-volume exposure |

## Privacy-safe tuning dataset

Collect only action class, allowed/denied count, safe error category, retry-after bucket, environment/channel/platform/version bucket, coarse latency and aggregate false-positive/support classification. Do not collect bodies, filenames/paths, signed URLs, room names, community/channel/message/user IDs, raw IP/device fingerprint, credentials/tokens/hashes/headers/cookies or arbitrary user values. A denial is a capacity/safety signal, not proof of abuse.

## Change guardrails

1. Separate staging/beta/stable and real-user/synthetic traffic; establish at least two representative windows.
2. Model legitimate p99 bursts (offline queue, reconnect, screen-share token retry, onboarding) and abuse/resource cost.
3. Propose one action/one dimension change with owner, hypothesis, expected false-positive/abuse impact and rollback value.
4. Run concurrency threshold+1, reset, second-user/tenant isolation, UI bypass, Retry-After and RLS tests.
5. Canary internal then small beta; compare denial/support/abuse/resource/SLO metrics.
6. Roll back on legitimate failure increase, support cluster, core send/join regression or bypass/abuse growth.

Never tune by weakening auth/RLS/permissions, trusting renderer IP headers, adding in-memory serverless counters, logging content, or retrying unsafe requests aggressively. Global/gateway limits complement per-user counters and must avoid one tenant starving another.

## Candidate review ranges, not configured values

- Messages: evaluate 20-60/min only after offline-queue/order tests.
- LiveKit token: evaluate 6-20/min with reconnect/device/screen-share scenarios.
- Reactions/feed: evaluate coalescing before raising 60-180/min.
- Upload metadata: evaluate 10-30/5min only alongside bytes/objects/concurrency.
- Webhook/bot: no relaxation while public surface is disabled; define cost-weighted scopes first.

These ranges are hypotheses, not production promises or client-visible config.

## Abuse events and response

Log backend denial aggregates and stable reason/action only through restricted redacted pipelines. Repeated/suspicious patterns may create abuse signals after policy review, but moderator/admin access is audited and no raw private content is exposed. Security incidents and cross-tenant attempts override normal tuning experiments.

## Blockers

Provider Auth/gateway configuration evidence, trusted upload grants/quotas, live Supabase concurrency tests, production-safe observability, false-positive support labeling and named Security/Operations owners are missing. Keep limits fixed until blockers close.
