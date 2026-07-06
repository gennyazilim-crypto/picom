# Incident Response Runbook

This runbook is for Picom, an Electron desktop community chat app for Windows, Linux, and macOS with Supabase-backed auth/database/storage/realtime and LiveKit/WebRTC voice features.

Mobile incidents are out of scope. Never include secrets, auth tokens, message bodies, private channel content, or user passwords in incident notes.

## Severity levels

| Severity | Definition | Examples | Response expectation placeholder |
| --- | --- | --- | --- |
| SEV0 | Security/privacy incident or suspected data loss/access leak | Private channel leak, data loss suspected, credential exposure | Immediate all-hands response and release freeze |
| SEV1 | Core app unavailable or major beta/stable outage | Backend down, database unavailable, login failure spike | First responder within 15 minutes |
| SEV2 | Major feature degraded but chat mostly usable | Realtime outage with API fallback, upload outage, voice outage | Triage within 1 hour |
| SEV3 | Limited issue or beta-only regression | Notification delivery issue, isolated desktop install failure | Triage next business day |
| SEV4 | Informational/known issue | Non-blocking warning, minor UI glitch | Track in backlog |

## Escalation path placeholder

1. Incident commander placeholder owns timeline and decisions.
2. Engineering lead owns technical mitigation.
3. Operations owner checks health, database, Redis, storage, and deployment state.
4. Security owner joins immediately for SEV0 or private data exposure suspicion.
5. Support/product owner prepares user-facing communication.

## First 15 minutes checklist

1. Confirm the incident type, start time, affected platforms, and severity.
2. Check `/health`, `/health/live`, and `/health/ready`.
3. Check Supabase dashboard status and recent deploy/migration history.
4. Check desktop release channel and recent rollout changes.
5. Decide whether to pause rollout or activate a kill switch.
6. Create an incident timeline entry with redacted facts only.
7. Assign incident commander, technical owner, and communications owner.

## First hour checklist

1. Identify whether the issue is backend, database, realtime, storage, desktop release, or configuration.
2. Mitigate user impact with rollback, kill switch, degraded mode, or communication.
3. Verify mitigation with staging/beta/prod smoke flow as appropriate.
4. Monitor SLOs and error trends after mitigation.
5. Publish or draft status communication if users are affected.
6. Decide whether to keep rollout paused.
7. Schedule postmortem for SEV0/SEV1 and any repeated SEV2.

## Incident type runbooks

### Backend down

- Symptoms: API requests fail, health summary unavailable, desktop shows backend unavailable/degraded banner.
- First checks: `/health/live`, `/health/ready`, recent deploys, environment variables, Supabase Edge Function health if involved.
- Logs/metrics: backend request logs, readiness status, API error rate, request IDs.
- Mitigation: restart service, roll back backend deploy, enable degraded mode if API-only features can continue.
- Rollback: revert backend release after confirming desktop compatibility.
- Communication: state that chat/API connectivity is degraded; avoid exposing infrastructure details.
- Postmortem: required for SEV1 or repeated SEV2.

### Database unavailable

- Symptoms: auth may work but communities/messages/members fail to load; readiness fails database check.
- First checks: Supabase/Postgres status, connection pool, migration activity, backup status.
- Logs/metrics: database connection errors, slow query logs, migration logs, query timeout rate.
- Mitigation: stop write-heavy jobs, restore database availability, pause deploys.
- Rollback: database rollback may be unsafe; verify backups and migration direction first.
- Communication: explain data access is temporarily unavailable, not that data is lost unless confirmed.
- Postmortem: required for SEV1 and any suspected data loss.

### Redis unavailable

- Symptoms: realtime/presence scaling degraded; readiness may fail if Redis is required in production.
- First checks: Redis connectivity, adapter status, environment config, fallback mode.
- Logs/metrics: Redis ping failures, realtime adapter warnings, reconnect rates.
- Mitigation: use in-memory/local fallback only if safe for the environment; otherwise mark realtime degraded.
- Rollback: revert realtime scaling/config changes if they introduced Redis dependency failure.
- Communication: mention realtime presence/message updates may be delayed.
- Postmortem: required if message delivery was affected.

### Realtime outage

- Symptoms: messages require refresh, typing/presence stale, two-window realtime test fails.
- First checks: Supabase Realtime status, socket connection errors, Redis adapter if enabled.
- Logs/metrics: reconnect attempts, realtime subscription errors, event delivery latency.
- Mitigation: show degraded banner, rely on API fetch/poll fallback where available, pause risky realtime deploy.
- Rollback: revert realtime event/schema changes or adapter config.
- Communication: chat may still work but live updates are delayed.
- Postmortem: required for SEV1/SEV2 lasting over 30 minutes.

### Login failure spike

- Symptoms: valid users cannot log in/register/session restore; auth errors increase.
- First checks: Supabase Auth status, auth env config, recent RLS changes, desktop auth flow errors.
- Logs/metrics: auth error rate, invalid credential vs service errors, session restore failures.
- Mitigation: roll back auth changes, pause release, provide workaround if sessions are still valid.
- Rollback: revert auth UI/service or Supabase policy/config changes.
- Communication: users may have trouble signing in; no password details are logged or requested.
- Postmortem: required for SEV1.

### Message send failure

- Symptoms: composer sends fail, optimistic messages stay failed, realtime confirmations missing.
- First checks: message insert API, RLS policies, channel permissions, rate limits, Supabase errors.
- Logs/metrics: send success rate, rejected error codes, request IDs, channel/user permission failures.
- Mitigation: roll back message service/schema/RLS change, disable risky editing/realtime feature if needed.
- Rollback: revert backend function/policy migration only after checking compatibility.
- Communication: users may need to retry failed messages; failed text should remain recoverable.
- Postmortem: required if core chat was blocked.

### Upload outage

- Symptoms: image attachments fail, previews unavailable, storage errors increase.
- First checks: Supabase Storage/object storage status, upload validation, bucket policy, file size/type limits.
- Logs/metrics: upload failures, storage status, rejected MIME/file-size counts.
- Mitigation: disable uploads with kill switch if unsafe; keep text chat running.
- Rollback: revert storage config or upload validation changes.
- Communication: image upload/preview is temporarily unavailable; text chat continues.
- Postmortem: required if data loss or privacy leak is suspected.

### Corrupted release

- Symptoms: installer/package fails checksum, app will not start after installation, artifact metadata mismatch.
- First checks: checksums, release provenance, artifact upload logs, signing/notarization placeholders.
- Logs/metrics: installer failure reports, checksum mismatch reports, release pipeline logs.
- Mitigation: pull release artifact, pause rollout, publish replacement or previous known-good build.
- Rollback: use desktop rollback procedure and verify client/server compatibility.
- Communication: tell users not to install affected artifact; provide safe download path.
- Postmortem: required for any public artifact withdrawal.

### Bad desktop update

- Symptoms: new desktop version crashes, startup safe mode triggers repeatedly, renderer error spikes.
- First checks: release ring, build metadata, crash recovery logs, known changed files.
- Logs/metrics: crash-free sessions, diagnostics exports, renderer error summaries.
- Mitigation: pause rollout, use kill switches for risky features, publish hotfix or roll back update feed placeholder.
- Rollback: desktop rollback must consider server compatibility and local data migration version.
- Communication: acknowledge affected Windows/Linux/macOS release and provide safe recovery steps.
- Postmortem: required for SEV1 or bad stable release.

### Security incident placeholder

- Symptoms: suspicious access, leaked secret, abuse spike, vulnerability report, suspicious admin action.
- First checks: secret exposure, audit logs, abuse events, affected systems, active sessions.
- Logs/metrics: redacted audit logs, account activity, abuse events, deployment history.
- Mitigation: rotate secrets, revoke sessions, disable affected feature, preserve evidence.
- Rollback: only after containing exposure; do not destroy audit trail.
- Communication: coordinate through security owner; avoid speculation.
- Postmortem: mandatory SEV0.

### Data loss suspected

- Symptoms: missing messages/communities/uploads, row count anomalies, failed migration, restore complaints.
- First checks: backups, migration logs, data integrity checks, affected IDs/time window.
- Logs/metrics: database logs, backup verification, integrity scripts, storage object audit.
- Mitigation: freeze destructive jobs, stop migrations, snapshot current state, prepare restore plan.
- Rollback: database rollback may not be safe; restore only after approval and verification.
- Communication: say data loss is under investigation until confirmed.
- Postmortem: mandatory SEV0.

### Private channel access leak suspected

- Symptoms: user reports private messages/channels visible without access, RLS failure, search leak.
- First checks: RLS policies, frontend visibility filters, search endpoint, attachment access, realtime room joins.
- Logs/metrics: permission denied/allowed events, audit logs, affected community/channel/message IDs.
- Mitigation: disable search/realtime/private-channel access path if needed, patch RLS, revoke leaked sessions if required.
- Rollback: revert policy or API changes that opened access; verify with isolation smoke tests.
- Communication: security/privacy owner approves all messaging.
- Postmortem: mandatory SEV0.

## Verification after mitigation

- Run staging smoke test before promoting a fix where practical.
- Verify Windows, Linux, and macOS desktop clients can still start and connect.
- Confirm health/readiness recovered.
- Confirm affected user flow manually: login, community load, message send, realtime, upload, or voice as relevant.
- Record rollback/mitigation commit or release version.

## Known risks

- Database rollback can be unsafe after destructive or non-reversible migrations.
- Desktop clients may continue running old versions during backend rollback.
- Supabase/LiveKit provider incidents may require degraded mode rather than direct fix.
- Diagnostics must stay redacted; do not request passwords/tokens/screenshots of secrets.

## Post-incident review template

Use `docs/postmortem-template.md` once available. Until then, capture:

- Incident title, severity, dates/times, affected platforms.
- User impact and affected systems.
- Timeline and detection method.
- Root cause and contributing factors.
- Mitigation and rollback steps.
- Follow-up actions, owners, due dates, prevention plan.

## Release checklist reference

The production deployment checklist should reference this runbook before release approval. If that checklist does not exist yet, add the reference when it is created.
