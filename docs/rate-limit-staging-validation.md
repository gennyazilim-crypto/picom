# Rate-limit staging validation

## Current result - 2026-07-10

Status: **BLOCKED / NOT RUN**. No staging URL/key, two fresh synthetic-user credentials, or fixture channel
IDs are available. No provider request/counter mutation occurred. Structural tests are not hosted evidence.

## Threshold decision: unchanged

Do not tune without representative staging/beta allowed/denied/false-positive/resource evidence. Current
backend values remain message 30/user/60s, attachment metadata 20/user/300s, reaction 120/user/60s,
relationship 30/user/60s, feed 120/user/60s, and LiveKit token 10/user/60s. These are fixed server values,
not client security. A denial is not proof of malicious behavior.

## Prepared hosted test

Use two fresh dedicated members in an isolated staging community with writable text and voice channels. Set:

- `PICOM_RATE_STAGING_URL`, `PICOM_RATE_STAGING_ANON_KEY`
- `PICOM_RATE_STAGING_CONFIRM=STAGING_ONLY_FRESH_SYNTHETIC_USERS`
- `PICOM_RATE_STAGING_USER_A_EMAIL/PASSWORD`, `PICOM_RATE_STAGING_USER_B_EMAIL/PASSWORD`
- `PICOM_RATE_COMMUNITY_ID`, `PICOM_RATE_CHANNEL_ID`, `PICOM_RATE_VOICE_CHANNEL_ID`

```powershell
npm run rate-limit:staging:preflight
npm run rate-limit:staging:test
```

The bounded runner consumes exact threshold+1 counters, checks bounded retry seconds, second-user isolation,
message/attachment trigger bypass denial without inserted rows, and LiveKit 429/`Retry-After` without a token.
It does not print identifiers, credentials, content, paths, tokens, URLs, or provider payloads. Dedicated users
must be unused in the relevant windows before each run.

## Unclosed surfaces

- **BLOCKER: Auth provider** - Dashboard rate limits/CAPTCHA/SMTP quotas and safe `AUTH_RATE_LIMITED` behavior
  need an approved provider test; do not brute-force or lock real accounts.
- **BLOCKER: invite** - create/accept/list/revoke RPCs have no dedicated server user/community/gateway limiter
  or `Retry-After` mapping. The placeholder Edge Function is JWT-protected but not rate-limited.
- **BLOCKER: search** - `search_accessible_entities` caps result count but has no request-frequency/cost limiter,
  minimum interval, or user-friendly 429 mapping.
- **BLOCKER: uploads** - attachment metadata is limited, but Storage object bytes/objects/concurrency can be
  uploaded before metadata. Add a trusted upload grant/gateway/provider quota and orphan monitoring.
- **BLOCKER: Edge Functions** - `validate-file`, invite/moderation/notification/export/deletion/public health
  endpoints need endpoint/tenant/gateway limits appropriate to cost; LiveKit is the currently enforced example.

Webhooks keep their separate credential limiter but remain disabled for public production. These gaps prevent
a complete staging rate-limit pass and should not be hidden by raising/lowering existing DB thresholds.

## User-facing and logging expectations

Auth, message, and upload services map provider/DB limits to stable wait-and-retry copy without raw backend
messages. Add invite/search mappings when enforcement is implemented. Abuse records may contain action type,
safe reason code, severity, request ID, timestamp, and aggregate counts only. Exclude password/token/secret,
authorization/cookie/session/JWT/API key, raw IP, message body/content, filename/path, signed URL, and response
payload. Respect bounded `Retry-After`; never aggressively auto-retry auth, upload, or unsafe mutations.

## Tuning evidence and rollback

Collect privacy-safe per-surface allowed/denied rates, retry-after buckets, latency/resource use, legitimate
p95/p99 bursts, support false-positive labels, and abuse outcomes across at least two representative windows.
Change one threshold at a time, canary internal/small beta, and rollback on core send/join failures, support
clusters, denial spikes, or bypass growth. Frontend throttles never replace backend enforcement.
