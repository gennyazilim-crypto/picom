# Observability and SLO dashboard specification

## Status

Provider-independent specification only. No telemetry backend, production datasource, dashboard URL, credential or user-content collection is enabled. Targets remain internal objectives until two representative baseline windows and owner approval exist.

## Global dashboard controls

Every board shows environment, release channel, Picom version, desktop platform, service region where approved, time range, data freshness/last sample and deployment annotations. Production, staging, beta and mock data are isolated. Missing/stale data displays **unknown**, never green or zero.

Allowed low-cardinality dimensions: environment, release channel, app semantic version bucket, Windows/Linux/macOS, operation class, safe error-code category, service and region. Forbidden labels/log payloads: user/session/device identifiers, IP, email/username, community/channel/message/attachment IDs or names, message/search/voice/screen content, URL/path/query, auth header, token, stack locals and arbitrary user-generated values.

## Executive SLO board

| Panel | SLI | Window/target | Warning | Page/rollback signal |
| --- | --- | --- | --- | --- |
| API uptime | successful synthetic readiness + eligible API responses / total | rolling 30d, 99.5% | 1% errors/15m | readiness 5m or 5%/15m after deploy |
| Auth success | valid login/register/session restore success / eligible attempts | rolling 30d, 99.0% | failures >2%/15m | >5%/15m or broad login blocker |
| Message send | confirmed eligible sends / eligible sends | rolling 30d, 99.0% | failures >3%/10m | <97%/10m, duplicates or private-data risk |
| Realtime stability | connected or recovered within 30s / sessions requiring realtime | rolling 30d, 98.5% | reconnect failure >3%/15m | >5%/15m or duplicate/drop cluster |
| Upload success | completed valid uploads / valid upload attempts | rolling 30d, 98.0% | failures >3%/15m | >5%/15m or scanning/access-control issue |
| Crash-free sessions | sessions without unclean/crash event / eligible sessions | release ring + 7d/30d, 99.0% placeholder | <99% | <98% or startup crash cluster |

Security/private-channel leakage, credential exposure, data loss and artifact signature failure page immediately and override error-budget math.

## Drill-down boards

### API and dependencies

- request rate, success/error category, p50/p95/p99 latency and timeout by operation class;
- `/health/live` and `/health/ready` plus database, Storage, Realtime, LiveKit/Redis dependency state;
- deployment/release annotations and version comparison;
- no request/response body, raw route parameter or authorization data.

### Auth

- valid attempts/successes, safe error categories, session restore/revocation and rate-limit counts;
- provider/dependency availability without email/domain/user labels;
- failed-login abuse signals remain restricted security aggregates, not user lookup dashboards.

### Messaging and realtime

- send pending/confirmed/failed, deduplicated clientMessageId conflicts, queue age and reconnect recovery;
- subscription disconnect/reconnect, event lag, duplicate/drop detection and room-join denial aggregate;
- no message text, reaction/typing content, channel/community identity or private room name.

### Uploads

- valid attempt/success/failure by safe MIME family/size bucket, latency and scan/quarantine aggregate;
- Storage dependency and signed delivery errors;
- no filename, object path, URL, attachment ID/content or scanner evidence body.

### Desktop stability

- eligible/crash-free sessions by platform/version/channel, startup failures, safe-mode/recovery entry and update/install error category;
- diagnostics opt-in rate only as a coarse aggregate if privacy-approved;
- no raw stack in general dashboard; restricted crash provider access follows the crash-provider gate.

## Error budgets and burn alerts

Show 30-day objective, good/total counts, remaining budget and multi-window burn. Candidate thresholds before baseline validation:

- fast burn page: 14.4x budget consumption over 1h confirmed by 5m;
- slow burn ticket: 6x over 6h confirmed by 30m;
- availability dependency page when readiness is continuously failing;
- crash/install/auth/message/security release-ring thresholds from `docs/safe-rollout.md`.

Alerts include service/SLO/environment/platform/version bucket, start time, current value, freshness, deployment annotation, runbook and dashboard link. They exclude content/identities/secrets and never include raw provider payloads.

## Data quality and access

- counters have explicit eligible/excluded definitions and monotonic reset handling;
- client metrics are advisory and reconciled with authoritative server/provider counters;
- dashboards show delayed/missing samples and ingestion health;
- role-based least privilege, SSO/MFA where available, audited access/export and bounded retention;
- public/status views expose only reviewed aggregate availability;
- sampling never drops security audit events and is documented for denominator accuracy.

## Activation gate

Choose an approved provider, threat/privacy/vendor review schema and transport, deploy staging-only, validate synthetic failures and no forbidden labels, establish two baseline windows, assign owners/on-call/runbooks, test alerts, then approve production ingestion. Until then dashboards are a contract, not operational evidence.
