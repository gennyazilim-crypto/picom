# Picom Production Migration Runbook

This runbook is manual and approval-gated. No Picom script automatically applies production migrations.

## Preconditions

- Exact release commit and migration set are frozen.
- Production project ref/region are independently confirmed.
- Current backup/PITR status and a recent restore drill are verified.
- Migration reviewer, database operator, incident lead, and rollback/forward-fix owner are available.
- Staging was rebuilt from the previous production schema and successfully migrated to the candidate schema.
- Desktop compatibility, RLS, Storage, Realtime, and Edge Function checks passed in staging.

If any precondition is missing, stop. Do not use `db reset`, seed scripts, or destructive local commands against production.

## 1. Local static preflight

```powershell
npm ci
npm run supabase:smoke
npm run supabase:rls:smoke
npm run supabase:rls:production-safe
npm run typecheck
npm run build
```

The production-safe script never connects to a database. It checks that expected migrations, policy tests, and verification documentation exist.

## 2. Install and authenticate Supabase CLI

Use an official Supabase CLI installation method and a named least-privilege operator/CI identity:

```powershell
supabase --version
supabase login
```

Store `SUPABASE_ACCESS_TOKEN` and the database password in protected operator/CI secret storage. Never pass them in command history, docs, screenshots, or renderer env files.

## 3. Verify target before linking

1. Compare the approved production project ref with the release ticket/private operations record.
2. Announce the migration window and freeze conflicting schema changes.
3. Link locally only after two-person target confirmation:

```powershell
supabase link --project-ref $env:SUPABASE_PROJECT_REF
supabase migration list
```

Stop if the remote migration history differs from the expected production baseline.

## 4. Review migration impact

- Read every SQL file not present in the prior production release.
- Classify additive, data-changing, locking, destructive, RLS, Storage, and Realtime changes.
- Estimate lock duration and affected row count.
- Confirm released desktop clients tolerate additive schema/event fields.
- Prefer expand-and-contract changes; do not drop old fields during the same rollout that introduces replacements.
- Document a forward-fix when rollback would destroy or misinterpret data.

## 5. Backup gate

- Record latest successful automated backup/PITR timestamp.
- Verify the backup belongs to the target project/region.
- Verify a restore drill completed within the approved interval.
- Capture schema/migration version and safe pre-deploy row-count snapshots.
- Confirm object storage recovery expectations separately from Postgres backup.

No risky migration proceeds without backup evidence.

## 6. Apply in the approved window

Use the reviewed Supabase migration command only after approval:

```powershell
supabase migration list
supabase db push
supabase migration list
```

Do not run `supabase db reset`, development seeds, ad-hoc SQL, or unreviewed dashboard edits in production.

## 7. Immediate verification

Run safe metadata checks in SQL Editor with a named operator:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 20;
```

Then execute the manual access matrix in `docs/production-rls-verification.md` with synthetic production smoke accounts. Monitor auth errors, database errors, message send, Realtime, Storage, and Edge Function failures.

## 8. Failure handling

1. Stop further deployment steps and desktop distribution.
2. Preserve redacted CLI/database error evidence.
3. Determine whether the migration committed fully, partially, or not at all.
4. Prefer an reviewed forward-fix for irreversible/data-transforming changes.
5. Restore only under the backup/rollback runbook and authorized incident leadership.
6. Disable the dependent feature through safe configuration when possible.
7. Re-run RLS and core chat smoke before resuming rollout.

Database rollback is not always safe. Never run down migrations or restore over production merely to match a desktop build without compatibility review.

## 9. Completion evidence

Record release commit, migration list before/after, operator/reviewer, backup timestamp, start/end time, SQL metadata output, RLS matrix result, monitoring links, incidents, and go/no-go owner in the private deployment record. Do not store secrets or personal data in the record.
