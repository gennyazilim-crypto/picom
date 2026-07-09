# Rollback Runbook

This runbook covers rollback decisions for Picom backend, database, and desktop releases. Picom is an Electron desktop app for Windows, Linux, and macOS with Supabase-backed data/realtime/storage and LiveKit/WebRTC voice features.

Use this together with `docs/safe-rollout.md`, `docs/incident-response.md`, and `docs/production-deployment-checklist.md`.

## Core principles

- Prefer feature flags or emergency kill switches before risky destructive rollback when user data may be affected.
- Database rollback is not always safe. Verify backups before risky migrations and never assume down migrations can restore data.
- Desktop client/server compatibility must be checked before rolling back either side.
- Preserve audit logs, diagnostics, and incident evidence.
- Do not expose production secrets in rollback notes or commands.

## Rollback decision flow

1. Identify affected release: backend, database, desktop package, object storage config, realtime gateway, or feature flag.
2. Confirm severity using `docs/incident-response.md`.
3. Pause rollout if the issue affects beta/stable users.
4. Check if emergency kill switch can safely mitigate first.
5. Check database migration/data compatibility before code rollback.
6. Execute rollback in staging if possible, then production.
7. Verify recovery with smoke tests and SLO indicators.
8. Communicate known user impact and next steps.

## Backend rollback

### Use when

- API health/readiness fails after backend release.
- Message/auth/community/upload APIs regress.
- Edge Function or Supabase policy release causes failures.

### Steps

1. Pause deploy pipeline and release rollout.
2. Confirm current production version and previous known-good version.
3. Review database migration compatibility with the previous backend.
4. Roll back backend service/function release to known-good artifact.
5. Confirm `/health`, `/health/live`, and `/health/ready` recover.
6. Run targeted smoke: auth, create community, create channel, send message, upload attachment.
7. Monitor error rates for at least one evaluation window.

### Known risks

- Old backend may not understand new schema fields.
- RLS/policy changes may remain active even if backend code rolls back.
- Desktop clients may have cached remote config or feature flags.

## Database migration rollback limitations

Database rollback is high risk and must not be automatic.

### Before any rollback

1. Verify latest backup exists.
2. Verify backup restore path if the migration is destructive.
3. Identify data transformations that cannot be reversed.
4. Confirm no newer desktop/backend version depends on the migrated schema.
5. Get explicit approval from database/operations owner placeholder.

### Safer alternatives

- Roll forward with a corrective migration.
- Disable affected feature through emergency kill switch.
- Keep new columns/tables and roll back code only.
- Restore from backup only when data loss/corruption is confirmed and approved.

### Never assume

- A down migration restores deleted data.
- Schema rollback is safe while clients are still writing.
- Backup exists unless it has been verified.

## Desktop app rollback

### Use when

- New Windows/Linux/macOS package crashes on startup.
- Custom titlebar/native bridge breaks.
- Auth/session startup causes renderer errors.
- Release artifact is corrupted or incorrectly packaged.

### Steps

1. Pause desktop rollout ring.
2. Confirm affected platform and version.
3. Check build provenance and checksums.
4. Verify previous desktop version is compatible with current backend minimum version.
5. If auto-update is not production-ready, publish manual install guidance placeholder.
6. If update feed exists later, point stable/beta channel back to previous known-good version.
7. Ask users to export logs only through redacted diagnostics.
8. Validate startup, login/session restore, chat, message send, and theme toggle on rolled-back version.

### Known risks

- Local settings/schema migrations may not downgrade cleanly.
- Older clients may not understand newer remote config values.
- Users may remain on the bad version until they manually reinstall if auto-update is not active.

## Auto-update rollback placeholder

Production auto-update is not part of the current MVP. Future rollout should:

- Keep previous artifact available.
- Support pausing an update channel.
- Avoid serving bad artifacts after rollback.
- Verify checksums and provenance before re-publishing.

## Feature flag rollback

Use feature flags for availability/visibility rollback when backend security is still enforced.

Examples:

- Disable risky realtime behavior.
- Disable uploads during storage outage.
- Hide voice/screen-share entry points during LiveKit outage.
- Disable message editing/reactions if they regress.

Steps:

1. Change remote/local config flag in the safest control plane available.
2. Confirm desktop clients receive config or use safe defaults.
3. Verify disabled feature shows clear unavailable state.
4. Confirm backend still rejects unauthorized access.

## Emergency kill switch usage

Use emergency kill switches for critical risk reduction:

- `disableRealtime`
- `disableUploads`
- `disableVoiceRooms`
- `disableNativeNotifications`
- `disableMessageEditing`
- `disableInvites`

Kill switches are not a substitute for permissions or RLS. They are a fast availability/safety control.

## Object storage rollback considerations

- Storage policy rollback can expose or hide attachments; review private channel access before changes.
- Do not delete uploaded objects during incident response unless explicitly approved.
- If malware/quarantine status is involved, keep suspicious files blocked.
- Verify signed/public URL behavior after policy rollback.
- Database restore does not restore missing Storage object bytes; use the separate object recovery plan.
- Preserve object writes/evidence before changing policies or lifecycle rules.

## Edge Function rollback

1. Identify the failing function and deployed version/source commit.
2. Confirm its database/RLS/secret contract remains compatible with the previous bundle.
3. Redeploy the previous reviewed function bundle from protected release source.
4. Do not copy old secrets from logs; use current approved secret store values or rotate them.
5. Re-run JWT denial, authorization, CORS, redaction, and functional smoke.
6. Keep dependent desktop feature disabled/unavailable until verification passes.

## LiveKit configuration rollback

1. Disable voice/screen-share entry points if token/room authorization or provider connectivity is unsafe.
2. Revert Function/provider configuration to the last documented known-good values through protected control planes.
3. Rotate LiveKit API credentials immediately for suspected exposure.
4. Verify room naming, Supabase identity, token TTL/grants, two-user audio, screen share, and leave cleanup.
5. Core text chat must remain available or clearly degraded while LiveKit is disabled.

Live rooms/media are ephemeral; database restore does not restore an active voice room.

## Known bad desktop build response

1. Pause the affected release ring/channel and remove the bad artifact from normal download surfaces without destroying evidence.
2. Publish a clear status notice with platform/version/symptom and whether user action is required.
3. Verify the previous artifact checksum/provenance and backend minimum-version compatibility.
4. Provide manual uninstall/reinstall instructions because production auto-update is not part of Full MVP.
5. Do not ask users to delete local data unless corruption is proven and recovery impact is explained.
6. Monitor remaining bad-version sessions/reports and prepare a hotfix if rollback cannot reach users safely.

## Realtime compatibility considerations

- Realtime event shape changes can break older desktop clients.
- Rolling back backend publishers while newer clients are connected may cause duplicate or missing events.
- Confirm message send API still works even if realtime is degraded.
- Verify room joins reject unauthorized/private channel access after rollback.

## User communication placeholder

Communication should include:

- Affected platforms: Windows, Linux, macOS.
- Affected release channel: internal, beta, stable.
- User-visible symptom.
- Whether action is required.
- Whether data is safe or still under investigation.
- Link to support/status page placeholder.

Avoid speculating about root cause until confirmed.

## Verification after rollback

- `/health`, `/health/live`, `/health/ready` pass.
- Staging smoke or targeted production smoke passes.
- Windows and Linux desktop clients can start and connect.
- macOS client verified if in rollout ring.
- Login/session restore works.
- Community/channel/message/upload flows work.
- Realtime two-client test works or degraded mode is visible.
- No private channel access leak is present.
- Incident timeline is updated.

## Related documents

- `docs/safe-rollout.md`
- `docs/incident-response.md`
- `docs/production-deployment-checklist.md`
- `docs/staging-smoke-test.md`
- `docs/postmortem-template.md`
- `docs/backup-restore-runbook.md`
- `docs/database-restore-drill.md`
- `docs/release-rollback-checklist.md`
