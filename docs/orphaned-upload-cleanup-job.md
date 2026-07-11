# Orphaned Upload Cleanup Job

Picom has a production-safe, operator-controlled foundation for cleaning uploaded files that never become attached to authoritative metadata.

## Current state

- Attachments use `public.attachments` with `status` values: `pending`, `attached`, and `failed`.
- The inventory covers all Full MVP buckets documented in `docs/supabase-storage-lifecycle.md`.
- Pending upload paths use the `pending/{userId}` segment.
- Destructive cleanup is never automatic; it requires server-only credentials plus explicit confirmation.

## Processor behavior

`scripts/lib/jobs/cleanup-orphaned-uploads.mjs` exports:

- `isOrphanedUpload(attachment, options)`
- `cleanupOrphanedUploads(options)`

The processor treats an upload as an orphan candidate only when:

- `messageId` is empty.
- `status` is `pending` or `failed`.
- `createdAt` is older than the configured grace period.

The default grace period is 24 hours.

## Safety guarantees

- Attachments linked to a message are never considered orphaned.
- Dry-run is the default for the manual script.
- No file is deleted unless `dryRun: false` and a `deleteFile` adapter is explicitly provided.
- Metadata marking is optional and requires a `markOrphaned` adapter.
- Missing storage paths or missing adapters are reported as errors instead of guessed.

## Commands

```powershell
npm run uploads:cleanup:smoke
npm run uploads:cleanup:dry-run
```

With `SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY`, dry-run invokes the service-role-only `list_storage_orphan_candidates` RPC. Without them it reports `BLOCKED` truthfully.

## Apply mode

Apply mode deletes only candidates returned by the server-side inventory after the grace period. It requires `PICOM_CONFIRM_STORAGE_DELETE=DELETE_ORPHANS` and `--apply`. The script logs aggregate counts, never private filenames or content.

Production scheduling remains intentionally disabled until staging dry-run, backup, and cross-user RLS evidence are approved.
