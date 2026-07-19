# Disaster Recovery Runbook (T94)

## Targets
- **RPO (max data loss): 24h** with Supabase managed daily backups; reduce to minutes by enabling
  **PITR (requires Pro plan)** — same tier gate that blocks branching.
- **RTO (max downtime): 4h** for a full-project restore.

## What is backed up
- Postgres (all tables, functions, RLS, cron schedules) — Supabase managed backups.
- Storage buckets (avatars/attachments) — included in Supabase backup scope; verify per plan.
- **Not** in DB backups: Edge Function code + secrets (redeploy from repo `supabase/functions/` +
  re-enter secrets), Auth SMTP config, custom domains.

## Restore procedure
1. Supabase Dashboard → project `piso` → Database → Backups → restore latest (or PITR point).
2. If the project itself is lost: create a new EU project, restore backup into it, then:
   a. `supabase db push` any migrations newer than the backup (repo `supabase/migrations/` is the
      source of truth — every prod change this program made is committed there).
   b. Redeploy Edge Functions from `supabase/functions/` (respect `release-manifest.json` scope).
   c. Re-enter Edge secrets (LIVEKIT_*, social auth) — operator only; never in repo.
   d. Verify pg_cron jobs exist (`select jobname from cron.job`) — expected: process-analytics-queue,
      analytics-data-quality, daily-analytics-rollup, analytics-minimization*, refresh-realtime-counters
      (*if T56 applied).
   e. Update `VITE_SUPABASE_URL`/anon key in client env; rebuild/release desktop app if URL changed.
3. Run smoke checks: `run_analytics_data_quality()`, `check_slos()`, sign-in, message send.

## Drills
- Quarterly: restore latest backup into a scratch EU project, run step 3 checks, record results.
- After every major schema change: confirm the migration file is committed (it is the DR source).

## Operator open items
- Enable PITR (Pro plan) to shrink RPO from 24h to minutes.
- Record the storage-bucket backup scope for the current plan.
