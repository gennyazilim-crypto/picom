# Task 38 Checkpoint: Backup, Restore, and Rollback Drill

## Scope

- Added a component-aware backup/restore runbook.
- Updated the staging restore drill to the active Supabase `auth.users`/`public.profiles` schema and optional-table handling.
- Expanded rollback guidance for Storage, Edge Functions, LiveKit, and known-bad desktop builds.
- Added a release rollback checklist and emergency communication template.

## Safety

- No backup, restore, migration, SQL, object cleanup, provider change, or destructive operation was run.
- No production credential was added.
- Backup/PITR/restore success is not claimed; real drill evidence remains required.

## Validation

- `npm run backup:verify:smoke` - placeholder safety smoke passed; no restore executed.
- `npm run database:restore-drill:smoke` - document smoke passed.
- `npm run rollback:smoke` - passed.
- `npm run typecheck` - passed.
- `npm run mock:smoke` - passed.
- `npm run build` - passed with the known non-blocking chunk warning.

## External work remaining

- Confirm the selected Supabase plan’s backup/PITR and Storage recovery capabilities.
- Execute a timed isolated staging restore with synthetic side effects disabled.
- Archive redacted RTO/RPO, integrity, app smoke, and approver evidence.
