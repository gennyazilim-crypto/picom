# Orphaned Upload Cleanup Job

Picom now has a safe development foundation for cleaning uploaded files that never become attached to a sent message.

## Current state

- Attachments use `public.attachments` with `status` values: `pending`, `attached`, and `failed`.
- Supabase Storage bucket: `message-attachments`.
- Pending upload paths use the `pending/{userId}` segment.
- A production destructive cleanup job is not enabled.

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

## Future Supabase implementation

When production cleanup is enabled, the adapter should:

- Select old `pending` or `failed` attachments with `message_id is null`.
- Delete the matching Storage object only after verifying it is not linked to any message.
- Update attachment metadata to `orphaned` only after a future migration allows that status, or keep a separate cleanup audit table.
- Log counts, not private filenames or user content.

## Not implemented yet

- No production scheduler.
- No destructive production cleanup.
- No `orphaned` database status migration.
