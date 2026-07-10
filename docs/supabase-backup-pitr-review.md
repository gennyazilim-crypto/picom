# Supabase backup and PITR production-tier review

Reviewed on 2026-07-10 against official Supabase documentation. Pricing, retention, plan names, compute
requirements, and platform behavior can change; Operations/Finance must revalidate them in the Dashboard
and official docs before purchase or release approval. This review makes no production configuration change.

## Current platform options

| Plan/tier | Managed database backup | PITR availability | Picom interpretation |
| --- | --- | --- | --- |
| Free | No automatic backup | Not included | Development only; regularly export logical backups off-platform. Not acceptable as sole production recovery. |
| Pro | Daily backups, last 7 days | Paid add-on | Minimum beta production tier; daily-only RPO may approach 24 hours. |
| Team | Daily backups, last 14 days | Paid add-on | Longer default retention and organization controls; justify substantially higher base plan cost. |
| Enterprise | Daily backups up to 30 days/custom terms | Paid/custom | Select only for contractual retention, support, compliance, or scale requirements. |

Point-in-Time Recovery is available as an add-on on Pro, Team, and Enterprise and requires at least Small
compute. When PITR is enabled it replaces daily backups. Official listed retention prices at review time are
7 days: $0.137/hour (about $100/month), 14 days: $0.274/hour (about $200/month), and 28 days: $0.55/hour
(about $400/month), per enabled project. PITR is billed hourly and is not covered by the Spend Cap. Small
compute and the base plan are additional costs. Staging PITR should remain off unless a drill/risk need is
approved; every enabled project incurs its own charge.

## Critical recovery limitations

- Storage objects are not included in database backups; only database metadata is captured. Restoring a
  database does not recreate object bytes deleted after the restore point.
- Edge Functions, deployed versions, Auth/OAuth settings and API keys, Realtime settings/publications,
  extensions/settings, read replicas, secrets, LiveKit configuration, and desktop artifacts need separate
  versioned recovery procedures.
- Project restore makes the project unavailable; downtime grows with database size. Record measured RTO.
- Custom database role passwords are not included in downloadable daily backups and may need reset.
- Deleting a project permanently removes data and provider backups. Project deletion requires independent
  backup/Storage export evidence and two-person approval.
- With physical backups/PITR, downloadable logical artifacts may not be available. Take a reviewed manual
  logical backup before disabling PITR or when portability is required.
- Restore-to-new-project is database-focused and incurs a new project/compute cost; Storage and dashboard
  configuration still require reconciliation.

## Recommended Picom decision matrix

| Phase | Proposed database control | Target placeholder | Approval state |
| --- | --- | --- | --- |
| Local/UI | Mock mode plus migration/seed source | Disposable | Accepted |
| Staging | Pro daily backup or isolated manual logical backup before risky tests | RPO 24h; restore drill monthly/before migration | Plan owner approval |
| Beta production | Pro daily 7-day retention minimum | RPO up to 24h; RTO measured in drill | PENDING APPROVAL |
| Stable production recommendation | Pro + Small compute + 7-day PITR | Operational target RPO <=15 min, RTO <=4h after evidence | PENDING APPROVAL |
| Higher retention/compliance | Team + 14-day PITR or Enterprise/custom | Policy/contract-specific | PENDING APPROVAL |

The stable recommendation balances early product risk and cost; it is not an automatic purchase. Finance,
Operations, Security/Privacy, and Engineering must approve the selected plan, RPO/RTO, retention, region,
budget alert, and rollback owner. Never weaken RLS/private Storage or skip restore testing to reduce cost.

## Storage and configuration recovery companion plan

1. Keep `message-attachments` private and create a separately encrypted/versioned object-copy or provider
   replication strategy with approved retention and deletion/legal-hold behavior.
2. Reconcile attachment metadata to object inventory/checksum during every drill; signed URLs are not backup IDs.
3. Keep migrations, RLS, functions, and non-secret configuration in Git with release provenance.
4. Maintain a redacted inventory for dashboard-only Auth, email, Realtime, Storage, and project settings.
5. Recreate/rotate secret values from the approved secret manager; never export them into Git backups.
6. Retain known-good Windows/Linux/macOS artifacts, checksums, provenance, and compatible server contract.

## Restore drill and evidence gates

Use `docs/backup-verification.md`, `docs/database-restore-drill.md`, `docs/ops/restore-drill.md`, and
`docs/backup-restore-runbook.md`. A provider backup timestamp is not proof of recoverability.

Before launch and quarterly thereafter (monthly during beta), restore an approved point into an isolated
staging/new project, disable outbound side effects, reconcile migration/RLS/Auth/Storage, run the hosted RLS,
Realtime, Edge Function, and desktop smoke matrices, measure achieved RPO/RTO, and clean up only after target
identity is reverified. A missing Storage object, private-access leak, failed Auth/session behavior, or
unmeasured restore remains a release blocker.

## Cost and monitoring gates

- Budget base plan, required Small compute, PITR per project, Storage backup capacity/operations/egress,
  temporary restore project/compute, operator time, and drill frequency.
- Alert on stale/missing recovery points, failed backup jobs, retention-window shrinkage, unusual database
  growth, Storage inventory mismatch, and PITR add-on unexpectedly enabled/disabled.
- Record costs in a restricted finance worksheet; source docs contain only review-date estimates.

## Official sources

- <https://supabase.com/docs/guides/platform/backups>
- <https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery>
- <https://supabase.com/pricing>
- <https://supabase.com/docs/guides/platform/clone-project>
