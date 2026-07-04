# Image Upload Bucket

Task 165 creates the Supabase Storage bucket migration for MVP image attachments.

## Bucket

- Name: `message-attachments`
- Public: `false`
- File size limit: `10 MB`
- Allowed MIME types:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  - `image/gif`

## Migration

`supabase/migrations/20260704002200_storage_message_attachments_bucket.sql` inserts or updates the bucket definition.

## Security notes

The bucket is private. The Electron renderer must not use service-role credentials. Client uploads and reads still need Storage policies and attachment metadata checks in later tasks.

## Manual verification

1. Run Supabase migrations locally.
2. Open Supabase Studio.
3. Confirm the `message-attachments` bucket exists.
4. Confirm it is private.
5. Confirm the file size limit and allowed image MIME types are configured.