# Picom data retention enforcement plan and safeguards

## Current enforcement status

**No destructive retention job is enabled by default.** Picom currently retains active database rows and storage objects unless an explicit user/moderator operation already exists. This document defines prerequisites for future server-side enforcement; it does not authorize deletion, add a scheduler, or change Electron behavior.

Retention must be approved by product, privacy/legal, security, operations, and the responsible data owner. Renderer code must never receive Supabase service-role or storage-administrator credentials.

## Policy hierarchy

1. Legal hold, active security incident, or preservation order overrides ordinary deletion.
2. Account-deletion and user-rights workflows use their reviewed rules and identity checks.
3. Community policy may shorten retention only within platform/legal limits.
4. Platform defaults apply when no reviewed community override exists.
5. A null/missing policy means retain, not purge.

Policy changes are prospective unless counsel and operations approve a documented backfill. Never interpret malformed, negative, zero, or out-of-range values as permission to delete.

## Data-class matrix

| Data class | Candidate rule | Enforcement action | Preservation checks | Default |
|---|---|---|---|---|
| Active messages | Approved platform/community age threshold | Archive first; purge only in a later reviewed phase | Legal hold, reports, thread/reply references, export request, channel/community state | Retain |
| Deleted messages | `deleted_at` plus approved grace period | Remove body first where policy allows; retain minimum tombstone/reference metadata | Reports, moderation case, appeals, audit references, backup status | Retain tombstone |
| Attachment metadata | Parent-message policy plus attachment grace period | Mark expired; delete storage only after reference check | Message/thread/report references, quarantine evidence, legal hold | Retain |
| Attachment objects | Metadata marked eligible and object identity verified | Backend-only object deletion | Exact bucket/path ownership, no active metadata reference, backup/restore plan | Disabled |
| Renderer/support logs | Bounded local age/size policy | Rotate local redacted entries | Active support export/incident hold; never auth secrets | Local rotation only when configured |
| Backend operational logs | Provider policy | Provider-side age/size rotation | Incident/security/legal hold and required access logging | Provider default pending review |
| Community audit log | Separate approved audit schedule | Archive to protected tier; no normal-message purge | Immutability, investigation, appeal, regulator/legal hold | Preserve |
| Account security events | Separate security schedule | Protected archive/anonymized identifier if approved | Account deletion, fraud, incident, legal hold | Preserve |
| Account deletion | Valid request after grace period | Controlled anonymization/finalization worker | Ownership transfer, cancellation, session revocation, legal hold, backup effects | No automatic finalizer |
| Data export payload | Short-lived generated artifact | Expire encrypted artifact and signed access | Active download, support/legal hold | In-memory synchronous payload only today |
| Export request metadata | Approved operational retention | Remove or aggregate metadata after period | Rights-request evidence and dispute hold | Retain pending policy |
| Backups | Backup lifecycle schedule | Expire whole backup set; never row-by-row edits | Restore coverage, immutable retention, incident/legal hold | Provider policy pending review |

## Required configuration boundary

Future jobs must require all of the following, supplied server-side:

```text
PICOM_RETENTION_MODE=dry-run|enforce
PICOM_RETENTION_POLICY_VERSION=<approved immutable version>
PICOM_RETENTION_CONFIRMATION=<change-ticket or one-time deployment approval>
PICOM_RETENTION_MAX_ROWS=<small bounded batch>
PICOM_RETENTION_CUTOFF=<explicit timestamp derived from approved policy>
```

Safe behavior:

- Missing/unknown values force `dry-run` or abort.
- `enforce` is rejected in local development and pull-request CI.
- A service role is loaded only in the isolated worker runtime.
- Every run has a request/run ID, policy version, bounded scope, start/end time, candidate counts, skipped counts, and redacted errors.
- Configuration must not include message bodies, tokens, signed URLs, passwords, or raw user exports.

No permanent `RETENTION_ENABLED=true` toggle is sufficient by itself. Production enforcement requires a reviewed deployment/change record and per-run limits.

## Execution lifecycle

### 1. Inventory and dry-run

The worker selects IDs and non-content metadata only, using a stable cutoff and keyset pagination. Dry-run must report counts by data class/community without returning message bodies, private filenames, storage paths, or user identifiers beyond approved redacted references.

### 2. Preservation filter

Candidates are removed from the batch if associated with:

- legal/security hold
- open report, moderation action, or appeal
- active data export or account-deletion review
- active thread/reply/reference requiring continuity
- storage metadata/object mismatch
- policy version changed since candidate selection
- parent community/channel not in the expected state

### 3. Approval gate

Operations reviews candidate counts, sample identifiers in a protected environment, verified backup status, restore-drill evidence, and expected user impact. Unexpected count drift, missing dependencies, or audit-log candidates blocks enforcement.

### 4. Bounded enforcement

Use small transactions and idempotent state transitions. Prefer archive or tombstone before irreversible purge. Commit database metadata state before deleting a storage object only when retry behavior cannot expose the object; otherwise use a documented two-phase tombstone/object-delete/finalize process.

### 5. Verification

After each batch verify relationship integrity, chat loading, private access, reports, exports, attachment rendering, realtime behavior, and audit-log immutability. Alert on mismatched candidate/deleted counts or orphan growth.

## Data-specific safeguards

### Messages and deleted messages

- Continue soft deletion for user-facing message removal.
- Older updates/realtime events must not resurrect tombstones.
- Purging a parent message must not leave replies/threads with unsafe or broken previews; use a deleted-content fallback.
- Search and exports must honor the same state and access rules.
- Moderation evidence should store the minimum reviewed excerpt or immutable reference, not silently retain all content indefinitely.

### Attachments

- Storage deletion is never inferred from age alone.
- Verify the exact metadata row, uploader/parent message, bucket, normalized object key, scan/quarantine status, and all references.
- Never log raw private paths or signed URLs.
- Thumbnail and original objects need coordinated lifecycle state.
- A failed object deletion remains retryable and blocked from public access; do not falsely mark it purged.

### Logs

- Renderer logs are redacted before storage/export and bounded by size/count.
- Backend logs use provider-side access control and retention.
- Security/incident holds suspend rotation for relevant protected records, not every private message.
- Audit logs are not ordinary debug logs and must not be processed by generic log cleanup.

### Audit and account-security logs

- Append-only records are preserved separately from message retention.
- No normal user, community delete, account deletion, or generic cleanup route may update/delete them.
- If a legally approved retention period is introduced, archive with integrity evidence and use a dedicated audited job, never the message purge worker.
- Anonymize user-facing identity carefully while preserving stable event integrity.

### Account deletion

- Session revocation, ownership transfer, exact confirmation, 14-day review, cancellation, and legal-hold checks precede anonymization.
- Historical messages may remain under a deleted-user identity where policy permits.
- Follows, saved records, preferences, memberships, profile data, Auth identity, attachments, audit references, and backups have separate finalization rules.
- The current application intentionally has no automatic anonymization/deletion worker.

### Data exports

- In-memory synchronous exports disappear on reload and need no object cleanup.
- A future asynchronous export must be encrypted at rest, private, short-lived, access-logged, and downloaded through a short-lived authenticated URL.
- Expiration deletes the artifact, not rights-request evidence needed for an approved operational period.

## Backup and restore impact

Backups are immutable snapshots; row-level deletion from active production does not normally rewrite existing backups. Policies and privacy notices must disclose approved backup retention and delayed erasure behavior.

A restore can reintroduce data that was deleted, anonymized, expired, or placed under a newer policy after the backup timestamp. Every production restore must therefore run a **post-restore reconciliation** before normal traffic:

1. Reapply completed account anonymization/deletion ledger entries created after the backup.
2. Reapply retention tombstones/finalization state using immutable run records.
3. Revoke sessions and credentials that were revoked after the backup.
4. Keep expired/quarantined attachments inaccessible and reconcile storage separately.
5. Reapply legal holds without deleting held evidence.
6. Verify audit/security logs were not lost or made mutable.
7. Run data-integrity and private-channel isolation checks.

If the reconciliation ledger or verified backup is unavailable, the restore is not ready for production traffic.

## Stop and rollback criteria

Immediately stop a run when:

- candidate/deleted count exceeds the approved bound
- an audit/security log is selected
- active, held, private, or referenced data is unexpectedly selected
- object and metadata identity differ
- database/storage error rate crosses the run threshold
- client errors, missing attachments, or integrity violations rise
- policy/config/version cannot be proven

Irreversible deletion cannot be rolled back transactionally across database and object storage. Recovery is restore plus post-restore reconciliation or a forward repair. This is why verified backup, limited batches, tombstones, and staged rollout are launch gates.

## Staging certification

1. Use synthetic/staging data with active, deleted, reported, held, threaded, exported, and quarantined cases.
2. Run dry-run and independently verify every candidate class.
3. Prove audit logs and held rows are never candidates.
4. Enforce one small staging batch.
5. Verify database relationships and storage object outcomes.
6. Restore a pre-run backup and execute post-restore reconciliation.
7. Run auth, communities, channels, messages, uploads, reports, private access, search, export, and realtime smoke tests.
8. Record approvers, policy version, commands, counts, redacted evidence, failures, and decision.

## Production enablement blockers

- Counsel-approved retention and user notice by region.
- Versioned policy/config storage and legal-hold model.
- Isolated server worker with dry-run, bounded batches, idempotency, and metrics.
- Verified backup and successful restore/reconciliation drill.
- Attachment two-phase deletion and orphan detection.
- Audit/security-log exclusion tests.
- Incident stop control, alerts, and accountable on-call owner.
- Staged rollout and written change approval.

Until every blocker is closed, production mode remains retain-only.
