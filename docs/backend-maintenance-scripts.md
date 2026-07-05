# Backend Maintenance Scripts

Picom includes safe placeholders for common backend maintenance operations. These scripts are intentionally conservative and do not contain production secrets.

## Available scripts

- `npm run db:backup:placeholder`: dry-run database backup path.
- `npm run db:restore:placeholder -- --backup=path --confirm-restore`: guarded restore placeholder.
- `npm run invites:cleanup:dry-run`: expired invite cleanup dry run.
- `npm run uploads:cleanup:dry-run`: orphaned upload cleanup dry run.
- `npm run storage:check`: read-only storage provider check placeholder.
- `npm run health:check`: read-only backend health check placeholder.
- `npm run admin:create:placeholder -- --email=admin@example.com --confirm-create-admin`: guarded admin bootstrap placeholder.
- `npm run create-admin-user -- --email=admin@example.com --confirm-create-admin`: explicit admin bootstrap alias.
- `npm run dev:reset-data -- --confirm-reset-dev-data`: guarded development reset placeholder.

## Safety rules

- Destructive scripts are guarded by `PICOM_ALLOW_DESTRUCTIVE_MAINTENANCE=true` plus an explicit confirmation flag.
- Production maintenance requires `PICOM_ALLOW_PRODUCTION_MAINTENANCE=true`.
- No production secrets are committed or printed.
- Connection strings are redacted before logging.
- Backups and restores should be tested in staging before production use.

## Production TODO

- Wire managed Supabase backup export or `pg_dump` in a controlled CI/operator environment.
- Restore only into a temporary or staging database until the restore drill is verified.
- Add object storage integrity checks once the production provider is finalized.
- Keep admin bootstrap behind an operator-only process.
- Follow `docs/admin-user-bootstrap.md` before implementing a real privileged account creator.
