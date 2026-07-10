# Alerting and on-call playbook

## Status and safety

Operational template; no pager provider, private roster, phone number, credential or production routing key is committed. Assign named primary/secondary responders and test routing before stable launch. Alerts contain aggregate service/SLO facts only, never message/attachment content, identities, tokens, private URLs, stack locals or raw provider payloads.

## Severity and response targets

| Level | Trigger | Acknowledge | Action |
| --- | --- | ---: | --- |
| SEV0 | security/privacy leak, credential compromise, data loss, malicious artifact | immediate | freeze releases, contain, Security/Privacy/IC all engaged |
| SEV1 | core auth/chat/backend/database unavailable or broad startup crash | 15 min | page primary+secondary, incident channel/status draft |
| SEV2 | realtime/upload/voice or one platform materially degraded | 30 min | page domain owner, IC if >30m/broadening |
| SEV3 | limited beta/version issue, slow-burn budget alert | business hours | ticket with owner/due date |
| SEV4 | informational/capacity trend | planned review | backlog/weekly review |

## First responder

1. Acknowledge, record start/detection time and verify alert freshness/source; do not assume missing data is healthy.
2. Check correlated SLO, health/readiness, release/deploy/config annotations and user impact using aggregate signals.
3. Classify severity and affected platform/version/channel/service; SEV0 never waits for SLO confirmation.
4. Create incident record/timeline, assign Incident Commander, technical and communications owners.
5. Pause rollout or apply approved kill switch/degraded mode; permissions/RLS remain authoritative.
6. Verify mitigation with synthetic/targeted smoke, monitor two windows and preserve redacted evidence.
7. Hand off explicitly or remain owner until resolution/postmortem assignment.

Never restart/delete/rollback blindly, dump environments, query private content to diagnose a metric, disable security controls, or silence an alert without owner/expiry/reason.

## Routing and escalation placeholders

- API/database/storage: Operations primary, Backend secondary.
- Auth/RLS/private data: Auth/Backend primary; Security immediately for suspected access issue.
- Messaging/realtime: Realtime primary, Backend secondary.
- Desktop crash/install/update: Desktop/Release primary, Support secondary.
- Upload scanning/quarantine: Storage/Security primary.
- Voice/LiveKit: Voice primary, Operations secondary.

Unacknowledged SEV0/1 escalates to secondary after 5 minutes and executive/security duty placeholder after 10 minutes. SEV2 escalates after 15 minutes or immediately if impact broadens. Provider escalation uses approved support contracts stored outside the repository.

## Alert lifecycle

- Deduplicate by service/SLO/environment/version bucket and incident, not user/resource ID.
- Group symptoms under the root incident while preserving distinct security signals.
- Maintenance silence requires change ticket, scope, owner, start/end and automatic expiry; SEV0 security alerts are not broadly silenced.
- Flapping alerts are fixed/tuned after evidence, never permanently muted to reduce noise.
- Close only after recovery for two evaluation windows, user impact confirmation, rollback/pause decision and follow-up ownership.

## Communication templates

Initial: `Investigating <service> degradation affecting <platform/channel> since <UTC time>. Impact: <plain user symptom>. Next update by <UTC time>. Do not include private diagnostics.`

Update: `Mitigation <is in progress/has been applied>. <Feature> remains <degraded/available>. No user action is required unless stated. Next update by <UTC time>.`

Resolved: `Service recovered at <UTC time>. Impact window: <start-end>. <Safe user action if any>. Follow-up review is scheduled.`

Security placeholder: `We are investigating a potential security/privacy issue and have applied containment. Share only through the approved security channel; do not post sensitive evidence publicly.`

## Handoff and review

Handoff includes severity, impact, timeline, current hypothesis (clearly labeled), changes/rollbacks, dashboards/runbooks, remaining risks, next decision time and contacts. SEV0/1 and repeated SEV2 require blameless postmortem; alert quality review tracks false positive, missed detection, time-to-detect/acknowledge/mitigate, runbook gaps and owner/due date.

Related: `docs/incident-response.md`, `docs/observability-slo-dashboards.md`, `docs/rollback-runbook.md`, `docs/postmortem-template.md`.
