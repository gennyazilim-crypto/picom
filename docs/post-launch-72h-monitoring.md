# Picom Post-Launch 72-Hour Monitoring

## Current status

This plan is prepared but not active. Stable release is currently No-Go and no public launch occurred. Start the clock only after an explicitly approved beta/stable artifact is actually distributed.

## Objectives

- Detect startup, auth, core chat, privacy, media, and packaging failures quickly.
- Protect private community/channel/message/attachment boundaries.
- Pause rollout or roll back before impact expands.
- Provide clear user/support communication without exposing secrets/private content.
- Turn verified launch observations into incident fixes or an MVP+ backlog.

## Command center roles

| Role | Responsibility |
| --- | --- |
| Incident lead | Severity, containment, rollback/hotfix decision |
| Desktop/release | Artifact/install/startup/platform issues and release ring |
| Backend/database | Supabase Auth/Postgres/RLS/Storage/Realtime/Functions |
| Realtime/media | LiveKit voice/screen share/provider state |
| Security/privacy | Access leak, credentials, diagnostics/privacy handling |
| Support/comms | Intake, known issues, status/user updates |

Assign named primary/backup and contact path before launch. Do not put private phone numbers, credentials, or provider admin links in public docs.

## Signals to monitor

- Desktop install/upgrade/uninstall, first launch, startup/renderer crash, white screen, custom titlebar/window controls.
- Login/register/email verification/OAuth/session restore and account lockout/failure spikes.
- Community/channel load, permission errors, message send/edit/delete/reaction and optimistic duplicate reports.
- Upload validation/storage insert/attachment metadata/signed URL/reload/access-denial failures.
- Realtime connect/reconnect/disconnect, duplicate/missing/stale event reports.
- LiveKit token/join/microphone/mute/deafen/speaking/leave and screen source/publish/remote view/cleanup failures.
- Supabase database/API/Function/Storage/Realtime health, latency, 4xx/5xx, quota/resource limits.
- RLS denials: separate expected unauthorized denials from unexpected valid-user denials; any unexpected allow is security-critical.
- Diagnostics/feedback/crash reports by version/platform/environment/category/severity.

Never monitor message bodies, attachment contents/signed URLs, screen/audio content, tokens, auth headers, service-role/LiveKit secrets, raw IP, or unnecessary personal data.

## Severity

| Severity | Definition | Response |
| --- | --- | --- |
| SEV-0 | Confirmed private-data/credential leak, destructive corruption/data loss, malicious artifact/signing compromise | Immediately stop all rollout/downloads, disable affected service, incident/security/legal escalation, rotate secrets, preserve evidence |
| SEV-1 | Widespread install/startup/login/message failure, migration outage, unauthorized LiveKit token, severe platform blocker | Pause rollout immediately; rollback/kill switch/hotfix decision within first response window |
| SEV-2 | Important feature degradation affecting a significant cohort with workaround | Hold expansion, assign owner, hotfix candidate or clear known issue/degraded mode |
| SEV-3 | Isolated/minor UI/performance/support issue | Triage to backlog unless trend increases |

Reporter severity is not final. Incident lead and security/privacy owner classify impact.

## T+0 to first hour

- [ ] Confirm exact artifacts/hashes/signatures, release channel/ring, backend migration/function versions, and rollout start time.
- [ ] Verify public download/status/support links and rollback artifacts.
- [ ] Watch install/launch/auth/message/API/Realtime/Storage/Function/LiveKit health continuously.
- [ ] Run synthetic startup/login/message/private denial/upload/Realtime/voice checks on each active platform/ring.
- [ ] Confirm no private access allow, secret/log leak, or corrupted artifact.
- [ ] Sample redacted reports for version/platform/environment accuracy.
- [ ] Hold rollout expansion until first-hour owner review.
- [ ] Publish initial status/update time even when healthy if the communication plan requires it.

Immediate rollback/pause criteria:

- Any SEV-0.
- Repeatable private channel/message/attachment access by unauthorized account.
- Invalid/mismatched artifact checksum/signature/notarization.
- Widespread startup/login/core message failure.
- Migration failure/partial state or suspected data corruption.
- Unauthorized/arbitrary LiveKit token issuance.

## First day (T+1h to T+24h)

- [ ] Review error/failure rates by platform/version/ring, not only aggregate.
- [ ] Review auth/provider/email/session failures and abuse/rate-limit events.
- [ ] Review message success, duplicate/reconnect reports, Storage upload/signed URL/reload, Function errors.
- [ ] Review LiveKit region/network/permission/share cleanup patterns.
- [ ] Run periodic synthetic private access and core chat checks after configuration changes.
- [ ] Triage all blocker/critical feedback; update known issues/workarounds/status.
- [ ] Compare observed signals to SLO/alert placeholder targets and baseline anomalies.
- [ ] Decide expand/hold/reduce/rollback at scheduled checkpoints.

Hotfix criteria:

- Small, understood, testable fix for a high-impact defect where rollback is unsafe/insufficient.
- No schema/security expansion beyond the defect.
- New candidate passes targeted regression plus full quality gate and platform smoke.
- Explicit hotfix go/no-go, artifact hash/provenance, rollback, and user communication.

Do not hotfix around private-data/RLS failures using frontend hiding only.

## T+24h to T+72h

- [ ] Continue platform/version/ring trends and incident/feedback triage.
- [ ] Confirm no delayed attachment expiry/reload, session rotation, Realtime listener growth, memory, sleep/wake, or notification issues.
- [ ] Review backup/PITR/job/Storage quota and resource trends without running destructive cleanup.
- [ ] Verify resolved incident/hotfix/rollback cohorts and close only with evidence.
- [ ] Consolidate duplicates, update known issues, assign MVP+ candidates with evidence.
- [ ] At T+72h record launch result, SLO summary, incidents, rollback/hotfixes, open risks, support volume, and next monitoring cadence.

The 72-hour window does not end monitoring; it transitions to normal operations.

## Rollback decision matrix

| Situation | Preferred first action |
| --- | --- |
| Bad desktop artifact/startup regression | Pause artifact/ring; manual rollback to compatible prior artifact |
| Backend/Function regression compatible with current schema | Revert to known-good bundle/config and verify |
| RLS/private access leak | Disable affected capability/traffic, incident response, corrective policy; never frontend-only |
| Migration/data corruption | Freeze writes, preserve evidence, database incident decision; restore only with verified backup/approval |
| Storage privacy/error | Disable uploads/delivery path, keep bucket private, inspect policy/objects |
| LiveKit outage | Disable voice/share clearly; preserve text chat; revert config/function/provider if safe |

Use `docs/release-rollback-checklist.md` and `docs/rollback-runbook.md`.

## Communication template

```text
Picom service update
Time/timezone: <timestamp>
Status: <monitoring/investigating/rollout paused/mitigated/resolved>
Affected: <platform/version/capability/ring>
User impact: <concise verified symptom>
User action: <none/restart/manual reinstall/safe workaround>
Data status: <safe/under investigation/confirmed impact>
Current action: <hold/rollback/hotfix/degraded mode>
Next update: <timestamp>
Support/status: <approved public links>
```

Do not speculate, expose provider topology/admin URLs, or include user/private/secret data.

## 72-hour closeout record

- Release/version/artifacts/rings:
- Monitoring start/end:
- Decision owners:
- Platform cohort summary:
- API/Auth/message/upload/Realtime/LiveKit outcome:
- Security/privacy/RLS outcome:
- Incidents and response times:
- Rollbacks/hotfixes:
- Known issues/workarounds:
- SLO/threshold notes:
- Feedback/backlog links:
- Decision: continue / hold / roll back:
- Next review/owner:
