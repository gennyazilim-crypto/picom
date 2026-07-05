# Task 367 Checkpoint: Message Retention and Archiving

## Status

Completed as a safety-first documentation foundation. No destructive retention, archive, purge, database migration, or storage cleanup code was added.

## Changed files

- `docs/message-retention.md`
- `scripts/message-retention-smoke-test.mjs`
- `docs/task-checkpoints/task-367-message-retention-and-archiving.md`
- `package.json`

## Commands run

```bash
npm run message-retention:smoke
npm run typecheck
npm run qa:smoke
npm run build
```

## How to test manually

1. Open `docs/message-retention.md`.
2. Confirm destructive cleanup is disabled by default.
3. Confirm dry-run, backup verification, audit log separation, attachment safety, and rollback limitations are documented.
4. Run `npm run message-retention:smoke`.
5. Run `npm run typecheck && npm run qa:smoke && npm run build`.

## Notes

Retention jobs must be server-side only and must never expose Supabase service-role keys or storage admin credentials to the Electron renderer.
