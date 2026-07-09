# Picom Production Monitoring

## Objective

Detect user-impacting failures across the Electron client, Supabase, LiveKit, and release artifacts without collecting message content, credentials, or unnecessary personal data.

## Monitoring layers

| Layer | Signals | Source | Initial owner |
| --- | --- | --- | --- |
| Desktop release | version/channel/platform, startup/crash reports, package/install failures, update channel label | Redacted diagnostics, beta reports, release evidence | Desktop/release |
| Auth | login/register/session restore success, failure spikes, verification/provider errors | Supabase Auth dashboard/logs | Backend/security |
| Database/API | availability, latency, error rate, connection/resource limits, migration status | Supabase database/API metrics | Backend/operations |
| RLS/privacy | unexpected allow/deny reports, private-channel boundary smoke | Synthetic access tests, security reports | Backend/security |
| Storage | upload success, size/type rejection, policy denial, bucket/egress/quota | Supabase Storage metrics and redacted app errors | Backend/operations |
| Realtime | connect/reconnect/error rate, duplicate/missed event reports | Supabase Realtime metrics and client status | Realtime/backend |
| Voice/share | token Function errors, room connection, participant/minutes, TURN/region, share failures | LiveKit provider metrics plus redacted client state | Realtime/operations |
| Edge Functions | invocation, latency, 4xx/5xx, JWT/permission failures, secret/config errors | Supabase Function metrics/logs | Backend/security |

No real analytics or crash-reporting provider is added by this task. Provider selection, consent, data processing, retention, sampling, and secret configuration require separate approval.

## Minimum dashboards

1. API/database health and resource limits.
2. Auth success/failure and abuse/rate-limit trend.
3. Message send/realtime connection reliability.
4. Storage upload/rejection/error trend.
5. Edge Function errors/latency by function and error code.
6. LiveKit room/participant/connect/error/region usage.
7. Desktop release version/platform incident table and crash-free-session placeholder.

Dashboard access must be least privilege and MFA-protected. Public status pages show only service-level status, never admin links, project refs, user identifiers, SQL, or logs.

## Alert priorities

- Page/block rollout: backend unavailable, login failure spike, message send failure, private-data leak, secret exposure, corrupted installer, migration failure, widespread startup crash, unauthorized LiveKit token issuance.
- Urgent investigation: elevated API/Function/storage/realtime errors, LiveKit connection failures, quota/capacity risk.
- Ticket/backlog: isolated non-blocking UI/performance errors and known beta limitations.

Thresholds should align with `docs/slo.md`; placeholder targets are not production evidence until telemetry is implemented and baselined.

## Privacy limits

Do not collect or alert on message bodies, attachment contents/signed URLs, passwords, tokens, cookies, authorization headers, service-role keys, LiveKit secrets/tokens, screen frames/thumbnails, audio, raw IP, or private member data. Prefer error code, safe request ID, timestamp, app version, platform, environment label, and service status.

## Release and 72-hour watch

- Freeze dashboard/alert owners before rollout.
- Compare candidate version/channel and backend migration/function versions.
- Monitor internal/small-beta/stable rings separately where possible.
- Pause rollout on blocker thresholds and follow incident/rollback runbooks.
- Keep a time-stamped redacted decision log for the first 72 hours.

## Degraded service communication

Use the public status URL and in-app safe service state for user-relevant outages. Do not expose provider names, internal topology, admin dashboards, or secrets unnecessarily. State affected capability, workaround, next update time, and resolution.

## Retention and access

- Define operational metric/log retention before production provider integration.
- Keep security/audit records separate from renderer support logs.
- Limit support diagnostics to the incident/triage group and delete according to policy.
- Record dashboard/log access changes and rotate provider credentials on personnel/security events.
