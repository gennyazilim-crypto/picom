# Background Job Queue Foundation

Picom does not currently include a long-running production backend worker. The MVP backend path uses Supabase Auth, Postgres, Storage, Realtime, and Edge Functions. This task prepares a small development-only job queue foundation without adding a queue dependency.

## Job types

- `send_email_placeholder`
- `cleanup_expired_invites`
- `cleanup_orphaned_uploads`
- `notification_fanout`
- `audit_log_export_placeholder`
- `data_export_placeholder`
- `account_deletion_placeholder`

## Development behavior

The local in-memory queue lives in `scripts/lib/background-job-queue.mjs`.

It supports:

- `enqueue(type, payload)`
- `list()`
- `processNext(processors)`
- `drain(processors)`
- `shutdown()`

Jobs without processors complete as safe placeholders with `NO_PROCESSOR_PLACEHOLDER`. This lets follow-up tasks wire individual jobs one at a time.

## Production behavior

The in-memory queue is development-only. In production, background work should use one of these future paths:

- Supabase scheduled Edge Functions for periodic cleanup jobs.
- A managed queue/worker service if Picom later adds a long-running backend.
- A Redis-backed queue only if a backend runtime is introduced and Redis is part of the deployment.

## Safety notes

- Do not store passwords, tokens, auth headers, or private message content in job payloads.
- Destructive jobs must support dry-run mode until production policy is finalized.
- Queue logs should include job id and type, not sensitive payload values.

## Validation

```powershell
npm run jobs:smoke
```
