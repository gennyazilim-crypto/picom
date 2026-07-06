# Task 451 checkpoint: Database restore drill

## Status

Complete.

## Changed files

- `docs/database-restore-drill.md`
- `scripts/database-restore-drill-smoke-test.mjs`
- `package.json`
- `docs/task-checkpoints/task-451-database-restore-drill.md`

## Validation

- `npm run database:restore-drill:smoke`

## Notes

The runbook is staging-focused, safe by default, and includes validation for auth login, communities, channels, recent messages, upload metadata, roles/permissions, and audit logs.
