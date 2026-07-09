# Picom Release Rollback Checklist

## Decision and containment

- [ ] Incident severity, affected versions/platforms/users, start time, and owner are recorded.
- [ ] Rollout/update/download/deployment is paused.
- [ ] Known bad artifact/config/function version is preserved privately for evidence.
- [ ] Emergency kill switch/degraded mode is evaluated before destructive rollback.
- [ ] User data safety and possible data-loss window are stated honestly.
- [ ] Communication owner and next update time are set.

## Compatibility gate

- [ ] Previous desktop/backend/function version is compatible with current schema/RLS/events/config.
- [ ] Minimum/recommended client version will not block the rollback artifact.
- [ ] Local settings/data migration downgrade impact is reviewed.
- [ ] Database rollback is not assumed safe; forward-fix option is reviewed.

## Desktop rollback

- [ ] Previous Windows/Linux/macOS artifacts, hashes, provenance, and smoke evidence are available.
- [ ] Bad artifact is removed/blocked from normal distribution without silently replacing its checksum.
- [ ] Manual close/uninstall/reinstall instructions are platform-specific.
- [ ] Startup, login/session, titlebar, chat, message send, Settings/diagnostics, and connected compatibility are verified.
- [ ] User is not instructed to delete local data unless explicitly necessary and explained.

## Database

- [ ] Latest backup/PITR and restore drill are verified.
- [ ] Writes are frozen/controlled if needed.
- [ ] Migration partial-state and irreversible transformations are understood.
- [ ] Restore/forward-fix/rollback is explicitly approved by database and incident owners.
- [ ] RLS/private access matrix passes before reopening.

## Storage

- [ ] Attachment metadata and object data recovery are treated separately.
- [ ] Private bucket/policies remain private.
- [ ] Signed URL and access-loss behavior are reverified.
- [ ] No bulk object deletion/lifecycle cleanup runs during investigation without approval.

## Edge Functions and LiveKit

- [ ] Previous Function bundle/version and current secret contract are compatible.
- [ ] Protected functions still enforce JWT/resource authorization and redacted errors.
- [ ] LiveKit credentials are rotated if exposure is possible.
- [ ] Voice/screen share is disabled clearly until two-user/native smoke passes.
- [ ] Text chat remains available or degraded state is communicated.

## Verification and closeout

- [ ] Health/readiness/auth/message/upload/realtime indicators recover.
- [ ] Private channel/message/attachment denial is verified.
- [ ] Platform smoke passes for every affected release ring.
- [ ] Monitoring observation window and rollback success criteria are met.
- [ ] User/status/support communication is updated.
- [ ] Incident timeline, postmortem, follow-up owners/dates, and new known issue are created.

## Communication template

```text
Picom incident update
Affected: <platform/version/capability>
Status: <investigating/rollout paused/rollback in progress/recovered>
User action: <none/manual reinstall steps>
Data status: <safe/under investigation/confirmed impact>
Workaround: <safe workaround or unavailable>
Next update: <time/timezone>
Support: <approved channel/status link>
```

Do not speculate about root cause or include secrets/private user data.
