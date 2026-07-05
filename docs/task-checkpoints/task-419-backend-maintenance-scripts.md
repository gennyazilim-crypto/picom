# Task 419: Backend Maintenance Scripts

## Scope

- Added safe placeholder scripts for common backend maintenance tasks.
- Kept scripts conservative, local/development-first, and guarded.
- Did not add production secrets or destructive behavior.

## Scripts

- `db-backup-placeholder.mjs`
- `db-restore-placeholder.mjs`
- `check-storage.mjs`
- `check-health.mjs`
- `create-admin-user-placeholder.mjs`
- `reset-dev-data.mjs`
- `maintenance-scripts-smoke-test.mjs`
- Shared guard helpers in `scripts/lib/maintenance-guards.mjs`

## Validation

- `npm run maintenance:scripts:smoke`
- `npm run typecheck`
- `npm run build`

## Manual Test

Run read-only placeholders:

```powershell
npm run db:backup:placeholder
npm run storage:check
npm run health:check
```

Confirm guarded placeholders refuse to run without explicit confirmation:

```powershell
npm run db:restore:placeholder -- --backup=local.dump
npm run dev:reset-data
```
