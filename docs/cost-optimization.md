# Cost optimization review

## Status and principles

Picom currently uses/plans managed Supabase for Auth/Postgres/Storage/Realtime/Functions and LiveKit for voice/screen sharing, plus desktop CI/build artifacts and operational logging. This document defines measurement and guardrails; it does not change vendors, plans, quotas, runtime behavior, or production resources.

Provider prices, included quotas, regions and billing units change. Keep rates in a restricted finance worksheet/configuration reviewed against current provider pricing, never as source-code assumptions. Optimize only after measuring user impact, security and reliability.

## Monthly cost model

```text
total = fixed platform plans
      + database compute/storage/IO/backups
      + Auth/active-user usage
      + Realtime connections/messages/egress
      + object storage capacity/operations/egress/CDN
      + Functions/API/job invocations and duration
      + LiveKit participant/media minutes/egress/TURN/recording(if approved)
      + email/notification/security scanning providers
      + logs/metrics/traces/crash reporting retention/ingestion
      + CI minutes/cache/artifact storage/egress/signing runners
      + backup copies/restore drills
      + support/on-call/compliance and engineering operations
```

Model at least internal, beta-small, beta-all, stable-base, 3x growth and incident-spike scenarios. Separate fixed, linear, step-function, regional/egress and staffing costs.

## Unit metrics

Track privacy-safe daily aggregates:

- monthly/daily active users and organizations/communities;
- messages, reactions, read states and Realtime events;
- peak/concurrent Realtime connections;
- attachment uploads, bytes, thumbnails, scan operations and downloads;
- stored database/object/backup bytes and growth;
- API/Function/job calls, duration, retries and failures;
- voice/screen participant minutes, concurrent rooms, TURN/egress and reconnects;
- log/metric/crash events and retained bytes;
- CI jobs/minutes/cache/artifact bytes and downloads.

No message content, private channel names, user activity ranking, raw IP, token, path or secret is required for cost measurement.

## Supabase

### Cost drivers

- base project/compute tier and replicas/add-ons;
- Postgres CPU/memory/connections, database size, IO and indexes;
- backup/PITR retention and restore drills;
- Auth active users/provider email/SMS if used;
- Realtime connections/messages/egress;
- Storage capacity, operations and egress;
- Edge Function invocations/duration/egress;
- multiple environments/regions/projects.

### Guardrails

- index measured chat/read/search/report/admin query patterns; avoid speculative over-indexing;
- cursor pagination and hard limits on lists/search/admin exports;
- batch/coalesce typing/presence/read events and cap reconnect storms;
- connection pooling and bounded workers;
- thumbnails for feed/chat, full image only on preview;
- validated upload limits, orphan cleanup dry-run, retention only after approval;
- short-lived caches for safe aggregate config/insights, never stale authorization;
- staging/dev project schedules only where provider supports safely; production never scale-to-zero by accident;
- budget alerts by project/environment/service and daily anomaly review.

Do not reduce RLS, backups, security logs, restore capability or private storage to save cost.

## LiveKit

### Cost drivers

- participant minutes and concurrent rooms;
- inbound/outbound media bandwidth, resolution/frame rate/bitrate;
- screen sharing and simulcast layers;
- TURN relay usage and region/egress;
- recording/egress/transcription if ever approved;
- regional deployments and idle capacity for self-hosting.

### Guardrails

- voice joins only after permission/token checks;
- disconnect/cleanup stale sessions and stop tracks on leave;
- adaptive stream/dynacast/provider-supported quality controls after QA;
- screen-share quality presets and explicit user selection;
- no recording by default;
- per-user/community concurrency and abuse limits;
- aggregate quality/reconnect/participant-minute monitoring;
- region choice balances latency, residency and egress, not cost alone.

Never degrade accessibility, moderation safety, encryption-in-transit, or permission checks for cost.

## Attachments, storage and bandwidth

- Enforce MIME/signature/size limits before/while uploading.
- Prefer thumbnails in lists; reserve full objects for preview/download.
- Set cache headers according to public/private sensitivity; signed private URLs remain short-lived.
- Prevent duplicate/retried uploads with idempotency/checksum where privacy policy permits.
- Quarantine suspicious objects and prevent public delivery.
- Track unattached/orphaned objects with read-only reports before cleanup.
- Coordinate original/thumbnail/metadata retention and legal holds.
- Avoid base64 blobs in database/logs and unnecessary cross-region copies.

## Desktop builds and artifacts

Cost drivers include Windows/Linux/macOS matrix, Electron downloads/cache, code signing/notarization runners, artifact retention, visual/E2E screenshots and release downloads.

Guardrails:

- split fast PR gate from scheduled/release packaging while preserving required platform checks;
- use lockfile cache and stable Electron/toolchain cache keys;
- cancel superseded branch runs where safe;
- upload artifacts/screenshots only when needed and apply documented retention;
- avoid duplicate package builds across workflows;
- generate checksums/provenance in the release build, not by rebuilding;
- keep release artifacts immutable and do not sacrifice signing/security for cost.

## Logging and observability

- Default to structured redacted events and aggregate counters.
- Sample high-volume success/debug events; never sample security/audit failures blindly.
- Separate immutable audit/security retention from debug logs.
- Bound labels/cardinality; user/message IDs should not become metric labels.
- Apply per-source retention and archive only approved evidence.
- Alert on ingestion spikes, recursive logging and provider retry loops.
- User diagnostics exports remain local/user-controlled and redacted.

## Budget guardrails

Define approved monthly budget by environment and service. Suggested alert policy (percentages are placeholders requiring finance/operations approval):

- 50% forecast early warning;
- 75% forecast owner review;
- 90% forecast escalation/change freeze for non-essential spend;
- 100% or abnormal daily spike incident review.

Budgets must not automatically shut down core chat, Auth, private storage or security controls. Use remote config/kill switches only for clearly non-critical high-cost features and pair frontend state with backend enforcement.

Add per-operation ceilings:

- upload size/count and export range/rows/bytes;
- search/list page and request rate;
- concurrent voice/screen sessions and quality preset;
- job batch/retry/dead-letter limits;
- log event size/rate/cardinality;
- CI artifact retention and workflow concurrency.

## Cost anomaly response

1. Validate billing data and affected environment/service.
2. Check traffic, retries, reconnects, abuse, logs, jobs, storage growth and release activity.
3. Contain with least-impact safe limit/kill switch; never bypass security or delete data impulsively.
4. Preserve redacted evidence and open incident/change record.
5. Fix cause, verify user impact, monitor recovery and update forecast/guardrail.
6. Postmortem for material surprises.

## Review cadence

- Weekly during beta: usage trend and anomalies.
- Monthly: forecast versus actual by service/environment/unit.
- Before release: packaging/artifact/log/backup impact.
- Quarterly: plan/provider feature/region assumptions and architecture efficiency.
- Before new feature/region/provider: cost model plus worst-case/abuse scenario.

## Current recommendations

1. Keep Supabase Cloud and LiveKit strategy; do not switch vendors without measured need.
2. Instrument only aggregate cost units and configure provider budgets before beta expansion.
3. Prioritize pagination/indexing, event coalescing, thumbnail delivery, track cleanup, CI caching and log-cardinality controls.
4. Measure baseline before changing plans or quality.
5. Treat backups, RLS, scanning/quarantine, audit, signing and restore drills as required controls, not optional spend.
