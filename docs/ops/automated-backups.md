# Picom automated backups setup plan

## Status and safety boundary

Picom has a guarded backup plan, not a repository-owned production backup executor. `scripts/backup-placeholder.ps1` never connects to Supabase/Postgres/Storage, never reads credentials, and refuses a production target. Provider scheduling and production credentials belong in restricted Supabase/CI/secret-manager operations.

No committed file may contain a database URL with credentials, Supabase access/service-role key, LiveKit/OAuth secret, signed URL, or backup encryption key.

Supabase plan, daily-retention, PITR prerequisites/costs, and the pending Picom production decision are
reviewed in `docs/supabase-backup-pitr-review.md`. Revalidate official pricing before approval; no provider
backup or PITR setting is enabled by repository tooling.

## Backup scope

### Supabase Postgres

The primary database backup must cover:

- `auth` identity state needed for supported recovery
- `public` application schema and rows
- `storage` metadata and policies
- migration history, extensions, functions, triggers, constraints, grants, and RLS
- scheduled-job definitions if later enabled

Use the production Supabase plan's managed backups and point-in-time recovery where supported and approved. Record provider plan, region, encryption, RPO/RTO, retention, ownership, and restore limitations in the private operations register. Do not assume a logical dump alone captures all Auth/platform configuration.

### Storage metadata

Database backup captures bucket/object metadata but not necessarily the object bytes. Verification must reconcile:

- bucket ID and private/public configuration
- normalized object key
- object version/ETag or checksum where available
- size and content type
- attachment row/message/channel/community relationship
- scan/quarantine/thumbnail state

Never export signed URLs as backup identifiers.

### Storage bucket objects

Message attachments, thumbnails, profile avatars, community icons, and future private exports need a separate object strategy. Preferred options:

1. Provider-supported object versioning/replication in an approved region.
2. Scheduled encrypted copy to a dedicated backup account/bucket with write-only job identity and restricted restore identity.
3. Periodic inventory/checksum manifests to detect missing or changed objects.

Backup storage must not make private-channel objects public. Lifecycle expiration, object locks, cross-region transfer, cost, malware/quarantine state, and right-to-delete behavior require review.

### Edge Functions and configuration

Git is the versioned backup for reviewed Edge Function source, migrations, `supabase/config.toml`, deployment scripts, and non-secret configuration templates. CI should archive the exact commit and migration/function deployment manifest for every release.

Secret **values** are never backed up in Git or normal artifacts. The approved secret manager must back up/version secret names, ownership, rotation history, and recovery procedure according to provider capability. A disaster recovery runbook should recreate values through rotation rather than exporting plaintext secrets.

Dashboard-only Auth, OAuth, email, redirect, rate-limit, region, storage, and realtime settings need a redacted configuration inventory because Git may not represent them.

## Proposed schedule

Final numbers require product risk, Supabase plan, cost, and legal approval.

| Asset | Proposed beta schedule | Proposed retention | Verification |
|---|---|---|---|
| Managed Postgres/PITR | Continuous PITR if plan supports it; otherwise daily | 7 daily, 4 weekly, 3 monthly placeholders | Daily job status; monthly restore |
| Release/migration logical evidence | Before/after every production migration | Match release and legal/audit needs | Checksum and schema compare |
| Storage object replication/copy | Daily incremental; weekly inventory | Policy-aligned, not shorter than DB reference recovery | Daily count/error; monthly sampled restore |
| Storage metadata | With Postgres | Same database backup lifecycle | Object/row reconciliation |
| Function/config deployment manifest | Every deployment | Repository/release artifact retention | Commit/hash and environment compare |
| Secret inventory/rotation metadata | On change plus monthly review | Security policy | Owner/access/rotation review |

Target placeholders:

- Database RPO: 24 hours without PITR; 15 minutes with approved PITR.
- Storage-object RPO: 24 hours until replication is proven.
- Restore RTO: 4 hours for beta staging drill; production target requires measured evidence.

Do not publish these as SLOs until measured and approved.

## Automation architecture

1. Restricted scheduler invokes a provider/CI backup workflow using a dedicated least-privilege identity.
2. Workflow verifies environment/project ref against an allowlist and refuses missing approval context.
3. Database/provider backup is started or its managed status is queried.
4. Storage incremental copy/inventory runs separately with bounded concurrency.
5. Artifacts are encrypted and checksummed before retention storage.
6. A metadata manifest records source project, region, start/end, schema/migration version, object counts, checksums, result, and expiry without private content or secrets.
7. Monitoring alerts on failure, stale backup, missing object inventory, checksum mismatch, unusual size/count drift, or retention failure.
8. Verification selects a backup and restores into an isolated staging/temporary environment.

The backup identity should not also be able to delete production. The restore identity should be separately controlled and activated only for an approved drill/incident.

## Guarded local placeholder

Plan-only:

```powershell
npm run backup:plan
```

Smoke invariant:

```powershell
npm run backup:plan:smoke
```

Optional staging plan-manifest write (still no provider operation):

```powershell
$env:PICOM_BACKUP_PLAN_CONFIRM = 'staging-plan-only'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backup-placeholder.ps1 -Environment staging -Mode plan -WritePlan
```

The output is restricted to ignored `tmp/backup-plans`. Production is always rejected. Real production commands must remain in an approved private operations workflow.

## Verification and restore testing

Every backup class needs evidence beyond “job succeeded”:

1. Verify artifact/managed snapshot timestamp, encryption, checksum, region, retention, and access policy.
2. Restore database into an isolated staging target with outbound email/webhooks/notifications disabled.
3. Restore a representative private storage object set without exposing it publicly.
4. Run schema, RLS, relationship, orphan, object/metadata, and migration checks.
5. Run desktop auth, communities, channels, recent messages, attachments, permissions, realtime, voice token, audit, export, and account-state smoke tests as applicable.
6. Run post-restore retention/account-deletion/session-revocation reconciliation.
7. Destroy only the verified temporary target with explicit approval.
8. Store a redacted drill report with duration, RPO achieved, RTO achieved, failures, owner, and remediation date.

Use `docs/backup-verification.md` and `docs/database-restore-drill.md`. A backup is not launch-valid until a representative restore passes.

## Failure and incident handling

- A missed/stale backup pages the operations owner at the approved threshold.
- Two consecutive failures, checksum mismatch, unauthorized access, or suspected data loss invokes `docs/incident-response.md`.
- Do not delete the last known good generation while investigating.
- Rotate exposed backup credentials/keys and assess artifact access.
- Block risky migrations and retention enforcement while backup confidence is lost.
- Document recovery through the postmortem process.

## Production enablement checklist

- [ ] Approved Supabase plan and managed backup/PITR capability.
- [ ] Named database, storage, security, privacy, and incident owners.
- [ ] Secret-manager and encryption-key recovery process.
- [ ] Separate least-privilege backup and restore identities.
- [ ] Approved schedule, retention, region, RPO, and RTO.
- [ ] Storage object copy/versioning and metadata reconciliation.
- [ ] Release/function/dashboard configuration inventory.
- [ ] Monitoring and stale-backup alerts.
- [ ] Successful staging restore drill for the exact architecture.
- [ ] Legal/privacy review for retention, international transfer, deletion, and legal holds.

Until these are complete, repository tooling remains plan-only.
