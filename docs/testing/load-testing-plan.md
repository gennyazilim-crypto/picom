# Load testing execution plan

## Safety boundary

Load testing is allowed only in local in-memory mode or an explicitly approved disposable/staging environment. Production is denied by default and must not be enabled by a generic environment flag.

Required staging safeguards:

- dedicated Supabase/Storage/Realtime/LiveKit staging projects;
- synthetic accounts, communities, channels, messages and inert generated files;
- approved target host/project allowlist and environment owner;
- written test window, traffic ceilings, budget, abort thresholds and cleanup;
- no real credentials in repo/commands/report; secrets come from protected CI/environment;
- provider plan/rate-limit/load-test permission review;
- monitoring/on-call communication before start;
- unique run prefix and post-run deletion verification.

The existing `realtime-load-simulation.mjs` remains in-memory by default. Its `--execute` path is only a blocked placeholder and does not connect remotely.

## Scenarios

### Message API

- ramp synthetic authenticated send from 1 to 5/10/25 requests per second;
- stable `clientMessageId`/idempotency; small plain-text body only;
- measure p50/p95/p99, success, rate-limit/retry, duplicate rows and database saturation;
- verify per-channel order, optimistic/realtime reconciliation and no cross-tenant access.

### Realtime

- 25, 100 then 250 clients after previous stage passes;
- join permitted synthetic rooms, message echoes, bounded typing/presence, disconnect/reconnect;
- measure connect/reconnect latency, event delivery, duplicate/missing/out-of-order events, server/client CPU/memory and UI batch behavior;
- unauthorized room joins must remain rejected.

### Upload

- generated PNG/JPEG/WebP fixtures at small/medium/near-limit sizes; no archives/executables;
- 1 then 5 uploads per second with bounded concurrency;
- measure validation/upload/metadata/thumbnail/scan-placeholder latency, success, storage operations/egress and orphan cleanup;
- verify oversize/invalid MIME/rate-limit/quarantine failures and no public/private leak.

### Auth

- conservative provider-approved register/login/refresh/logout test using synthetic disposable accounts;
- begin at 1 request per second and stop on rate limiting/provider warning;
- measure success/latency/error shape/session revocation;
- never brute force, reuse passwords from users, test production email/SMS, or print credentials/tokens.

### Search

- allowlisted synthetic queries against seeded public/private channels;
- ramp 1/5/10 requests per second with page limits;
- measure p50/p95/p99, database CPU/IO/index usage and result completeness;
- prove unauthorized/private results remain absent under load.

### LiveKit token function

- synthetic authenticated voice-channel members only; token response discarded and never logged;
- ramp 1/5/10 requests per second within provider/Edge limits;
- measure function latency/success/rate limits and permission denials;
- no room/media connection in token-function test; separate LiveKit participant load needs provider approval and budget.

## Initial non-binding targets

These are staging review thresholds, not measured SLOs:

| Flow | Candidate threshold |
| --- | --- |
| Message send | >=99% accepted/expected rate-limited, p95 <=750 ms at approved stage, zero duplicate rows |
| Realtime | >=99% expected event delivery, zero unauthorized delivery, duplicate rate reconciled to zero UI duplicates |
| Upload | >=98% valid fixture success, p95 <=5 s near normal size, zero public/private leaks |
| Auth | >=99% success before expected provider rate limits, p95 <=1 s, zero token/log leakage |
| Search | >=99% valid response, p95 <=1 s, zero private-result leakage |
| Voice token | >=99% valid response before expected rate limits, p95 <=750 ms, zero token logging |

Thresholds require baseline/provider review before becoming release gates.

## Stages and abort criteria

1. Static/smoke and in-memory simulation.
2. Single-user staging correctness.
3. Low load for five minutes.
4. Step ramp with cool-down and review between stages.
5. Short bounded peak, never unbounded soak.
6. Recovery/reconnect and cleanup verification.

Abort immediately on private-data/tenant leak, production target, credential/log leak, unexpected email/notification, error/rate-limit threshold, database/storage saturation, cost alarm, data corruption, stuck cleanup, or incident-owner request.

## Results format

Record date/version/commit, target type (never secret URL), region, scenario/stage, synthetic dataset, duration/concurrency/rate, request/event counts, p50/p95/p99, success/expected-denial/unexpected-error, duplicates/loss/order, resource/cost, aborts, cleanup, caveats and decision. Redact all tokens, headers, passwords, private paths and user content.

## Current execution

See `load-test-results-2026-07-10.md`. Only an in-memory realtime simulation has been executed. Network-backed message/upload/auth/search/voice-token results remain unmeasured and must not be inferred from that simulation.
