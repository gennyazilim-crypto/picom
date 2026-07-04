# Task 165 Checkpoint: Create image upload bucket

## Completed

- Added Supabase Storage bucket migration for `message-attachments`.
- Configured private bucket, 10 MB limit, and image MIME allowlist.
- Added the bucket migration to the Supabase schema smoke test.
- Documented bucket verification steps.

## Changed files

- `supabase/migrations/20260704002200_storage_message_attachments_bucket.sql`
- `scripts/supabase-schema-smoke-test.mjs`
- `docs/image-upload-bucket.md`
- `docs/task-checkpoints/task-165-image-upload-bucket.md`

## Verification

Run:

```bash
npm run supabase:smoke
npm run typecheck
npm run build
```