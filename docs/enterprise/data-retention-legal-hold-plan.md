# Enterprise data retention and legal hold plan

## Status

**Planning only; retain-by-default.** No enterprise retention policy or legal hold is active. No destructive job, scheduler, hold UI, privileged endpoint, storage lock, or service credential is added by this plan.

Retention and legal hold require approved tenant architecture, jurisdiction-specific legal review, customer terms, data residency, immutable audit, isolated workers, backup/restore reconciliation, and accountable operations.

## Policy scopes

- Platform minimum/default policy applies to all data classes.
- Organization policy may define approved retention windows within platform/legal bounds.
- Workspace policy may become stricter within organization limits.
- Community policy may become stricter within parent limits where product/legal policy permits.
- Channel/user settings never weaken mandatory parent or legal rules.
- Missing, malformed, zero, negative, or unknown policy means retain; it never authorizes purge.

Effective-policy order: active legal/security hold, legal/platform minimum, organization, workspace, community/channel, then user preference. Store the resolved policy ID/version and decision evidence for each destructive candidate batch.

## Data-class policy

Separate policies are required for active/deleted messages, attachments and thumbnails, account/profile data, memberships/roles, reports/appeals/moderation evidence, audit/security events, exports, operational logs, caches, backups, and voice/realtime metadata. A single `retention_days` field is insufficient.

Audit/security evidence, reports/appeals, deleted-content tombstones, and backups have independent schedules. Message retention cannot delete them by cascade or generic cleanup.

## Legal hold decision

A hold is an authorized preservation instruction, not a community archive or monitoring feature. It can be created only for an approved enterprise organization by a dedicated compliance role through step-up authentication and dual approval.

Before final deletion, every worker asks a trusted hold decision service using exact tenant, data class, resource scope, policy version, and candidate timestamp. Results are:

- `preserve`: exclude candidate and record content-free evidence;
- `not_held`: continue only if all other checks pass;
- `unknown/error`: fail closed and retain.

The renderer, community owner, normal app admin, support user, bot, webhook, plugin, or feature flag cannot override a hold decision.

## Proposed schema impact

- versioned `enterprise_retention_policies` and immutable published policy versions;
- organization/workspace/community policy assignments with effective dates;
- `legal_hold_matters` with tenant, lawful reference, status, region, review/release dates;
- immutable versioned `legal_hold_scopes` for approved data classes/resources/time ranges;
- append-only hold lifecycle/access/export/integrity events;
- retention candidate/run/finalization ledgers with policy/hold decision evidence;
- optional preservation-object manifest/checksum records in tenant-correct protected storage.

Avoid cascade deletion. Actor/target references must preserve audit integrity through anonymization or stable tombstones.

## Access control

- `manageRetentionPolicy`: organization policy role, step-up, separation of duties.
- `proposeLegalHold`: compliance role; cannot activate alone.
- `approveLegalHold`: distinct authorized approver.
- `viewLegalHold`: exact matter/scope, time-bounded, need-to-know.
- `releaseLegalHold`: dual approval and disposition review.
- `runRetention`: isolated worker identity only.

Community administration does not imply enterprise retention/hold access. Backend permissions, tenant scope, lifecycle, and region are checked for every action; frontend gates are UX only.

## Retention execution

1. Inventory metadata-only candidates with stable keyset pagination and immutable cutoff.
2. Resolve effective policy and hold/security/report/export/reference checks.
3. Produce dry-run counts and skipped reason codes; do not return content/paths.
4. Require reviewed change ticket, verified backup/restore drill, bounded batch and explicit enforce token.
5. Prefer archive/tombstone, then separately approved irreversible purge.
6. Handle attachment metadata/object deletion with a two-phase idempotent state machine.
7. Verify counts, integrity, private access, chat/search/export/realtime behavior after every batch.
8. Append run/failure/completion evidence without content.

No permanent boolean enables destructive enforcement. Unknown config or policy mismatch aborts.

## Hold lifecycle

1. Propose matter and minimal scope.
2. Validate tenant, legal authority, region, custodians/resources, data classes, dates, conflicts, and notice constraints.
3. Independent approval activates an immutable scope version.
4. Preservation workers discover/verify eligible records and protected copies.
5. Access and export are separately authorized, encrypted, checksummed, short-lived, and audited.
6. Periodic review confirms necessity and scope.
7. Release requires approval and disposition review; normal retention resumes prospectively and does not imply immediate purge.

Deleted content preserved under hold never reappears in normal product UI.

## Audit and chain of custody

Append-only events cover policy proposal/publish/assign, dry run, enforcement, skip/hold decision, hold proposal/approval/scope version/access/export/integrity verification/release, artifact transfer/expiry, and failures. Store actor/matter/run IDs, bounded target references, policy/scope versions, timestamps, outcome, counts, checksums, and reason codes only.

Exclude preserved content, query text, passwords, tokens/hashes, headers, private paths/URLs, keys, raw IP, and unrestricted personal attributes.

## Backup and restore

Backups require their own approved lifecycle and hold coverage. After restore, block traffic until reconciliation reapplies later policy/hold decisions, deletions/tombstones, session revocations, quarantine, and artifact expiry. If the immutable reconciliation ledger is unavailable, the restore is not production-ready.

## Stop conditions

Stop and retain if scope/policy/hold/region cannot be proven, candidate count drifts, audit/security data appears, references conflict, object identity differs, backup/restore evidence is stale, integrity fails, or user-facing errors increase. Irreversible deletion recovery is restore plus reconciliation or forward repair, not transaction rollback.

## Approval gates

- counsel-approved lawful basis, notice, rights handling, retention schedule, and customer contract;
- accepted tenant/data-residency model and cross-tenant RLS tests;
- immutable policy/hold/audit schemas and protected storage/key ownership;
- isolated dry-run-first worker, two-phase object deletion, monitoring and emergency stop;
- successful staging enforcement plus backup restore/reconciliation drill;
- trained named compliance/security/operations owners and incident runbook;
- independent privacy/security review.

Until all gates pass, Picom remains retain-by-default and must not claim legal hold support.
