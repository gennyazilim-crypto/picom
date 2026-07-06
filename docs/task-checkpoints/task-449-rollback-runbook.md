# Task 449 checkpoint: Rollback runbook

## Status

Complete.

## Changed files

- `docs/rollback-runbook.md`
- `docs/production-deployment-checklist.md`
- `scripts/rollback-runbook-smoke-test.mjs`
- `package.json`
- `docs/task-checkpoints/task-449-rollback-runbook.md`

## Validation

- `npm run rollback:smoke`

## Notes

The runbook separates backend, database, and desktop rollback paths, documents that database rollback may not be safe, and references safe rollout plus incident response documents.
