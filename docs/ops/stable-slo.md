# Stable Release SLA/SLO Setup

Status: Proposed internal stable-release objectives  
Applies to: Picom Windows, Linux, and macOS desktop clients plus required Supabase, storage, realtime, and LiveKit services  
Measurement window: rolling 28 days, segmented by environment, release channel, client version, and platform

## SLA posture

These are internal service-level objectives, not a contractual SLA. Picom must not publish an availability or support commitment until production instrumentation has been privacy-reviewed, targets have been met for at least two complete windows, exclusions are approved, and legal/support/operations owners have signed the external terms.

## Measurement rules

- Count only production stable-channel activity; development, mock, staging, synthetic load, and unsupported client versions are separate series.
- Use validated, content-free events and server/provider outcomes. Local diagnostics are useful for support but are not the authoritative SLO source.
- Never attach user IDs, community/channel IDs, message text, attachment names/URLs, IP addresses, tokens, or arbitrary error strings to metrics.
- Deduplicate retries with request/event/client-message identifiers before calculating ratios.
- Separate user cancellation, explicit permission denial, invalid credentials/input, unsupported devices, and policy rejection from service-caused failures where specified below.
- Publish metric freshness and missing-data status. Missing telemetry is not success and blocks release decisions.
- Report global and Windows/Linux/macOS slices. A platform-specific breach is actionable even if the global aggregate passes.

## Stable SLOs

| SLO | 28-day target | Good event / numerator | Eligible event / denominator | Warning / page threshold | User impact | Primary owner | Rollback or mitigation criterion |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| App startup success | 99.7% | Stable client reaches authenticated or unauthenticated ready screen within 15 seconds without crash loop | Supported stable launches with a generated launch ID | Warn below 99.8% over 6h; page below 99.0% over 30m | Picom cannot be opened or remains blank/crashed | Desktop Engineering | Pause rollout for a new version if startup success is below 99.0% for 30m or is 0.5 percentage points worse than previous stable; kill optional startup services or roll back package |
| Auth success | 99.5% | Valid login, registration, refresh, or session restore completes without service/internal error | Syntactically valid attempts excluding wrong credentials, expired one-time links, user cancellation, policy blocks, and provider-declared abuse | Warn below 99.7% over 6h; page below 98.5% over 30m | Users cannot enter or remain in the app | Auth Engineering | Pause auth/client rollout when service-caused failures exceed 1.5% for 30m; restore previous Edge Function/config/client after session compatibility check |
| Message send success | 99.7% | Accepted message is durably committed and reconciled to the originating client exactly once within 10 seconds | Authorized, valid send attempts after local queue dispatch; deduplicated by `clientMessageId`/idempotency key | Warn below 99.8% over 2h; page below 99.0% over 15m | Core chat is unavailable, delayed, duplicated, or misleading | Messaging/Realtime | Disable risky realtime path or pause release when failure/duplication exceeds 1% for 15m; preserve queued text and use safe retry/degraded mode |
| Realtime stability | 99.5% | An active client remains connected or automatically recovers within 30 seconds without duplicate/corrupt events | Active foreground sessions that require realtime, excluding intentional offline/user shutdown | Warn below 99.7% over 2h; page below 98.0% over 15m | New messages, typing, presence, and read state are delayed | Realtime Engineering | Enable degraded polling/API mode or pause gateway/client rollout if recovery falls below 98% for 15m or duplicate ordering guard alarms fire |
| Upload success | 99.0% | Valid supported file uploads, scans clean/skipped only under approved development mode, stores metadata, and becomes safely retrievable within 60 seconds | Authorized uploads within published type/size limits, excluding user cancel and intentional malware/policy rejection | Warn below 99.3% over 4h; page below 97.0% over 30m | Users cannot share attachments or see completed media | Storage/Security | Disable uploads if validation, quarantine, scanner, signed-delivery, or orphan cleanup safety is uncertain; pause rollout below 97% for 30m |
| Voice join success | 98.5% | Authorized user receives a valid token and joins the intended LiveKit room with usable audio within 20 seconds | Supported-device join attempts excluding user cancellation and explicit OS permission denial | Warn below 99.0% over 4h; page below 95.0% over 30m | Voice rooms appear broken or users cannot communicate | Voice Engineering | Disable voice entry via feature flag or roll back token/client change if joins fall below 95% for 30m or wrong-room/security evidence appears |
| Crash-free sessions | 99.7% | Session ends cleanly or remains active without renderer/main-process crash or unrecoverable startup fault | Stable desktop sessions with a privacy-safe session identifier and clean/unclean termination classification | Warn below 99.8% over 24h; page below 99.0% for a release ring over 2h | Work is interrupted; app may enter recovery/safe mode | Desktop Engineering | Halt rollout when new version is below 99% or 0.3 points worse than prior stable; activate safe mode/kill switches and ship rollback/hotfix |
| Package install success | 99.0% | Signed/notarized package installs or upgrades and launches successfully on a supported clean/upgrade test path | Opt-in installer outcome or controlled release-ring install attempts, separated by platform/package format | Warn below 99.5% in a release ring; page below 97.0% after at least 20 attempts | Users cannot install, upgrade, or start Picom | Release Engineering | Pause artifact/update publication below 97%, on signature/notarization failure, or any destructive upgrade/data-loss report; withdraw affected artifact |

## Authoritative event contracts

| SLO | Required content-free events and server evidence |
| --- | --- |
| App startup | `app_launch_started`, `app_ready`, `app_start_failed`; version, channel, platform, safe failure code, duration bucket |
| Auth | Server/Auth provider valid-attempt and outcome counters; operation class and bounded provider/error class |
| Message send | Server commit result plus client reconcile result keyed by opaque deduplication ID; no body or channel label |
| Realtime | Connection lifecycle, reconnect result, disconnect reason class, duplicate/out-of-order guard counters |
| Upload | Storage/metadata/scan/delivery stage outcomes with MIME family and size bucket only |
| Voice | Token and room-join stage outcomes with platform, client version, safe failure/permission class |
| Crash-free sessions | Main/renderer clean-shutdown marker and redacted crash fingerprint; no stack trace in metric labels |
| Package install | CI artifact certification plus privacy-approved release-ring result; platform, format, version, outcome class |

The current local observability dashboard is not an authoritative source for these calculations. Production ingestion must validate allowlisted event schemas, apply rate limits/sampling, keep credentials server-side, and document retention/regional handling before enablement.

## Error budgets

| Target | Maximum bad events in a 28-day window |
| ---: | ---: |
| 99.7% | 0.3% |
| 99.5% | 0.5% |
| 99.0% | 1.0% |
| 98.5% | 1.5% |

Use multi-window burn-rate alerts once telemetry is live:

- Fast burn: approximately 14.4x budget consumption over both 1h and 5m; page immediately.
- Medium burn: approximately 6x over both 6h and 30m; page during the operating window.
- Slow burn: approximately 1x over both 3d and 6h; create an owned investigation.
- Security/privacy/data-loss incidents bypass error budgets and trigger incident response immediately.

When a core SLO exhausts 50% of its monthly budget in the first 7 days, stop discretionary launches in that domain. At 100%, freeze risky feature rollout until recovery work and an approved exception exist.

## Availability dependencies

Auth, message, upload, realtime, and voice SLOs must be correlated with Supabase/Postgres, Storage, Realtime/Redis where enabled, Edge Functions, and LiveKit provider health. Provider outage is still user impact and remains in the product SLO; it may be separately labeled for root-cause and vendor review.

## Release gates

A stable candidate is blocked when:

- any required SLO lacks valid production-quality instrumentation or freshness;
- the previous stable version already violates a core SLO without an approved recovery plan;
- staging smoke, clean migration/RLS, backup/restore, scanner/quarantine, or signed artifact certification fails;
- release-ring startup, crash-free, or install thresholds breach;
- a privacy, cross-tenant, private-channel, credential, data-loss, or update-corruption incident is open.

Stable rollout may proceed only from internal to limited stable ring to full stable while the dashboard, alerts, incident owner, kill switches, rollback artifact, support communication, and known-issues record are ready.

## Review cadence and ownership

- Daily during release rollout: release-ring startup, crash, install, auth, and message health.
- Weekly: SLO/error-budget review with engineering, operations, security, and support.
- Monthly: target and exclusion audit; do not silently relax an objective after a miss.
- Quarterly: privacy/retention, alert quality, provider dependency, platform coverage, and external SLA readiness review.

Named people and escalation contacts must be assigned in the private operations system before stable release. Repository role labels are ownership domains, not an on-call schedule.

## Current implementation gap

The repository defines safe metric names and a restricted local aggregate dashboard, but has no approved production telemetry ingestion/provider. These SLOs are therefore measurable specifications, not currently measured production claims. Production enablement requires consent/privacy review where applicable, schema tests, server-side ingestion, dashboards, alert rules, retention controls, runbook links, and two baseline windows before considering an external SLA.
