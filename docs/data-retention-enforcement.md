# Data retention enforcement plan

## Status and safety posture

Picom has a controlled enforcement plan and a guarded dry-run CLI placeholder. **No destructive retention job is enabled or implemented by default.** The placeholder cannot delete rows, Storage objects, logs, backups, audit records, or user content, even when its destructive guard inputs are supplied.

Final periods remain product/legal/privacy decisions. Values below describe enforcement categories and gates, not an active legal promise.

## Data schedule and enforcement ownership

| Data class | Default posture | Candidate trigger | Enforcement boundary | Restore/exception |
| --- | --- | --- | --- | --- |
| Active messages | Retain; no automatic purge | Approved global/community policy plus age cutoff | Trusted backend worker; never Electron renderer | Legal hold, active report, export request, ownership/integrity dependency |
| Soft-deleted messages | Retain tombstone/context | Approved deleted-message window plus grace period | Transactional server job | Active moderation/report/appeal, legal hold, audit linkage |
| Attachment metadata | Retain while message or protected case references it | Source message is eligible and approved attachment window elapsed | Database transaction coordinated with storage job | Quarantine/evidence hold, export, restore window |
| Original attachment objects | Private; no automatic purge | Metadata candidate verified unreferenced | Trusted storage worker after database decision | Scan evidence/legal hold, retry/rollback window |
| Thumbnail/derivative objects | Same or shorter than source, never longer | Source is purged/replaced/quarantined | Same storage job and purge manifest | None independent of source |
| Local app logs | Bounded/redacted local ring; user-clearable | Size/count/age policy | `loggingService`/cache management only | Crash/support export explicitly created by user |
| Backend operational logs | Provider-controlled until approved | Approved short operational window | Restricted operations configuration | Incident/security/legal hold with documented access |
| Abuse/security event logs | Separate security evidence policy | Approved security window | Restricted append/archival service | Investigation, appeal, legal hold |
| Audit logs | Excluded from message retention | Separate approved audit policy only | Dedicated append-only retention process | Legal/compliance hold; normal routes cannot purge |
| Backups/PITR | Provider policy not assumed | Approved backup schedule/window | Infrastructure operations | Deletion aging disclosure and restore re-deletion process |
| Exports/support bundles | User/support controlled and time-limited | Approved download/evidence window | Access-controlled export store/local user path | Security case/legal hold |

## Policy model before activation

An approved, versioned policy record should include:

- policy ID/version/effective date and approvers;
- global and optional community retention windows;
- deleted-message and attachment windows;
- grace period and legal-hold behavior;
- supported region/data class;
- dry-run start/end and expected candidate thresholds;
- backup verification and restore-drill evidence;
- rollout ring, kill switch, monitor/alert owner;
- audit event for policy change and execution;
- explicit exclusions for audit/security/report/appeal records.

`null`/missing policy means retain and do not purge. A shorter community policy cannot override legal, security, product minimums, active hold, or access/export obligations.

## Candidate selection

Selection must be server-side, cursor-paginated, deterministic, and read-only during dry-run:

1. resolve approved policy/version and current UTC cutoff;
2. exclude legal holds, active reports/appeals, active exports, and protected audit/security references;
3. select only soft-deleted/eligible rows older than cutoff and grace period;
4. verify community/channel/message relation integrity;
5. enumerate attachment metadata, original objects, derivatives, and scan/quarantine state;
6. produce aggregate counts and opaque job IDs, not message content/private paths/signed URLs;
7. compare candidate counts against absolute and percentage safety thresholds;
8. require named human approval before any bounded staging apply.

## Controlled execution design

- Scheduler enqueues a policy-versioned job; it never accepts arbitrary SQL/object paths.
- Worker acquires a singleton/idempotency lease per policy/shard.
- Database changes use bounded transactions and record an append-only execution summary.
- Storage deletion follows a committed database manifest with retries and reconciliation; it cannot infer object paths from user input.
- Each batch has maximum rows/objects/runtime and pauses on error-rate or count threshold.
- Realtime/search/cache receive tombstone/invalidation events only after commit.
- Audit logs are never part of the same query, transaction, cascade, or storage manifest.
- Logs contain job/policy IDs, aggregate counts, redacted error codes, and timings only.

## Guarded placeholder

Run the current read-only plan:

```powershell
npm run retention:plan
```

The command reports zero candidates and `destructiveExecutionEnabled: false`. `--apply` is blocked unless both the explicit environment flag and confirmation argument exist; even with both, it exits with `apply_requested_but_not_implemented` and performs no deletion. This prevents a documentation placeholder from becoming an accidental production purge path.

## Staging enablement sequence

1. Finalize legal/product/security retention schedule and public notice/copy.
2. Add policy schema and RLS with immutable versioning and restricted writes.
3. Implement read-only candidate query and validate against seeded/production-like staging data.
4. Restore a verified backup into isolated staging.
5. Run dry-run and peer-review the aggregate manifest.
6. Enable a maximum-one-batch staging apply with explicit operations guard.
7. Verify messages, search, reports, appeals, audit logs, attachments, thumbnails, backups, export/deletion, and private-channel access.
8. Restore/forward-fix failures and repeat until measured evidence meets go/no-go criteria.
9. Production remains disabled until change approval, rollout/kill switch, alerts, on-call, and rollback decision are ready.

## Failure and rollback

- Stop on missing policy, stale/failed backup verification, legal hold uncertainty, excessive candidates, permission/integrity mismatch, storage error threshold, or audit write failure.
- A database/storage hard delete is not simply reversible. Recovery may require backup restore plus forward reconciliation and re-deletion of data created after the backup.
- If database commit succeeds but object deletion fails, keep a restricted retry manifest; do not expose the orphan publicly.
- If object deletion succeeds but metadata commit fails, treat as incident/data-loss risk and restore/repair from verified backup where possible.
- Kill switch disables scheduling and new batch claims, not audit evidence or in-flight transaction integrity.

## Verification

- `npm run retention:plan`
- `npm run retention:enforcement:test`
- `npm run message-retention:smoke`
- `npm run audit-logs:immutability:smoke`
- `npm run uploads:cleanup:smoke`

No deployed retention behavior is claimed until staging and production evidence exists.
