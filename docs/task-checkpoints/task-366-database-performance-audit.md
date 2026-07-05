# Task 366 Checkpoint: Database Performance Audit

## Status

Completed as an audit/documentation task. No new database migration was added because the current MVP chat query paths already have targeted indexes.

## Changed files

- `docs/database-performance.md`
- `scripts/database-performance-smoke-test.mjs`
- `docs/task-checkpoints/task-366-database-performance-audit.md`
- `package.json`

## Commands run

```bash
npm run database-performance:smoke
npm run typecheck
npm run qa:smoke
npm run build
```

## How to test manually

1. Open `docs/database-performance.md`.
2. Confirm message pagination, member lookup, channel lookup, attachment lookup, reactions, read states, search, notifications, audit logs, and invite lookup assumptions are documented.
3. Open `supabase/migrations/20260704001200_chat_query_indexes.sql`.
4. Confirm core chat query indexes are present.
5. Run `npm run database-performance:smoke`.

## Notes

Future notification, audit, report, invite, and search tables should add indexes only when their runtime query shape is stable. Avoid over-indexing placeholder features.
