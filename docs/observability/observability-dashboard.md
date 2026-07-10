# Observability Dashboard

## Status

Picom includes a lightweight, restricted observability summary for development and app administrators. It is not a production telemetry backend and does not transmit metrics. The dashboard path is intentionally aggregate-only and uses recent redacted local signals.

## Goals

- Give release/support operators a quick view of core desktop reliability signals.
- Keep operational counts separate from private user content.
- Define a future metrics pipeline without enabling analytics or committing provider credentials.
- Make platform, package, and release-channel context visible during incident triage.

## Dashboard location and access

The lightweight summary is available in **Settings > Advanced > Admin Operations > Observability** when `adminOperationsService.getAccess()` allows access:

- Development builds receive explicit development access.
- Non-development builds require the app-admin RPC check.
- Normal users do not receive the Admin Operations entry.

This UI access check is not a replacement for backend authorization. A future metrics API must independently enforce app-admin access.

## Current safe summary

The local summary includes counts for:

- App starts.
- Authentication failures.
- Message-send failures.
- Realtime reconnects.
- Upload failures.
- LiveKit join failures.
- Screen-share failures.
- RLS/permission-denied errors.
- Locally queued redacted crash reports.
- Redacted abuse-event total.
- Picom package version and release channel.
- Electron runtime/platform label.

Event counts are best-effort matches over the bounded recent `loggingService` window. A zero does not prove that no production event occurred, and these values must not be used as SLO measurements.

## Privacy boundary

The dashboard must never expose:

- Message, reply, profile bio, attachment, or voice content.
- Community/channel names or private identifiers.
- Passwords, tokens, cookies, authorization headers, Supabase service-role values, or LiveKit secrets.
- Raw IP addresses, email addresses, session IDs, invite secrets, or filesystem paths.
- Per-user behavior timelines or detailed presence history.
- Raw provider payloads or stack traces to normal users.

Only aggregate counts, normalized service states, safe package metadata, and redacted logs are permitted. Metrics labels must use bounded enumerations and must not include user-generated strings.

## Future production metrics

| Metric | Suggested type | Safe labels | Initial alert signal |
| --- | --- | --- | --- |
| `picom_app_start_total` | Counter | version, channel, platform | Sudden drop after release may indicate startup failure. |
| `picom_auth_failure_total` | Counter | provider class, platform | Rate exceeds established baseline. |
| `picom_message_send_failure_total` | Counter | safe error code, mode | Error ratio exceeds message-send SLO threshold. |
| `picom_realtime_reconnect_total` | Counter | platform, reason class | Sustained reconnect spike. |
| `picom_upload_failure_total` | Counter | safe error code, size bucket | Upload success SLO breach. |
| `picom_livekit_join_failure_total` | Counter | platform, safe error code | Voice join failures above threshold. |
| `picom_screen_share_failure_total` | Counter | platform, permission class | Platform regression after release. |
| `picom_rls_denied_total` | Counter | operation class, entity class | Unexpected increase or forbidden-path probe. |
| `picom_crash_report_total` | Counter | version, platform, error fingerprint | Crash-free session budget at risk. |
| `picom_abuse_event_total` | Counter | bounded event type, severity | Abuse spike or control bypass attempt. |

Do not use `userId`, `communityId`, `channelId`, message text, URL query strings, arbitrary error messages, or stack traces as metric labels. High-cardinality and user-generated labels create privacy, cost, and operational risks.

## Proposed production architecture

1. Desktop services emit typed, content-free operational events.
2. A reviewed backend ingestion endpoint validates allowlisted event names and labels.
3. The backend applies authentication, rate limiting, sampling, and redaction.
4. A metrics provider stores aggregate time series; crash reports remain in their separately controlled provider.
5. A restricted operations dashboard queries aggregates rather than desktop-local logs.
6. Alert rules link to the SLO plan and incident response runbook.

The desktop client must not receive provider write credentials. If anonymous app health is enabled later, user consent, retention, regional handling, and privacy documentation must be approved first.

## Dashboard panels

Recommended production panels:

- Release health by version/channel/platform.
- Auth success/failure ratio.
- Message send success/failure ratio.
- Realtime connection stability and reconnect rate.
- Upload success/failure and safe error classes.
- LiveKit join and screen-share failure rates by platform.
- RLS denial trend and unexpected operation classes.
- Crash-free sessions and top redacted fingerprints.
- Abuse-event volume by bounded category.

All panels require an explicit time range, environment filter, freshness indicator, and data-source label. Development/mock data must not be mixed with production.

## Alerting and ownership

- Alerts use sustained windows and ratios where possible to avoid noise.
- Thresholds must be derived from the SLO document and measured baseline, not invented by the UI.
- Security-sensitive RLS/access-leak signals page the security/operations owner.
- Release-specific crash or failure spikes can pause rollout through the documented release process.
- Every alert needs an owner, runbook link, severity, and recovery condition.

## Implementation phases

1. Keep current restricted local aggregate summary for development diagnostics.
2. Define typed event names and bounded label schemas.
3. Add redaction/schema tests before network ingestion.
4. Implement a protected backend ingestion path with rate limits and no content fields.
5. Connect a reviewed metrics provider using backend-held credentials.
6. Add time-series operations panels and alert rules.
7. Validate privacy, retention, access, and data residency before production enablement.

## Known limitations

- Current counts are local, session-bounded, and best-effort.
- App-start logging coverage is not yet a production counter.
- No external metrics provider or alerting integration is configured.
- No production SLO calculation should use this local dashboard.
- Physical platform and release artifact context still requires release certification evidence.

