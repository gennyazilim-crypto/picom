# Message attachments table schema

Task 114 prepares the message attachment schema for Picom image attachments.

## Naming decision

The baseline migration already created `public.attachments`. To avoid a risky rename and preserve existing references, Picom keeps `public.attachments` as the canonical storage table and exposes `public.message_attachments` as a read-compatible view name for task/API documentation alignment.

## Table purpose

Message attachments store image metadata for chat previews, attachment grids, and future Supabase Storage object references.

## Baseline fields

- `id`: UUID primary key.
- `message_id`: optional message reference, cascades when the message is deleted.
- `uploader_id`: profile reference.
- `storage_path`: Supabase Storage object path.
- `file_name`: sanitized display file name.
- `mime_type`: uploaded MIME type.
- `size_bytes`: upload size in bytes.
- `attachment_type`: currently `image`.
- `width`: optional image width.
- `height`: optional image height.
- `public_url`: optional public or signed URL placeholder.
- `created_at`: creation timestamp.

## Schema hardening added

- `thumbnail_url`: optional future thumbnail URL.
- `status`: upload lifecycle status: `pending`, `attached`, or `failed`.
- File name, storage path, MIME type, public URL, and thumbnail URL length checks.
- Positive dimension checks for width and height.
- Indexes for uploader history, per-message attachment ordering, and status lookup.
- `public.message_attachments` view for compatibility with task naming.

## RLS and security notes

RLS is enabled on `public.attachments` in the baseline migration. Future policies must ensure users can only read attachments for messages/channels they are allowed to view. Supabase Storage policies must mirror the same access boundaries.

Do not expose raw local filesystem paths. `storage_path` should be a Supabase Storage object key, not a Windows/Linux local path.

## Test steps

1. Apply migrations in a local Supabase project.
2. Insert a valid image attachment row with a message id and uploader id.
3. Query `public.message_attachments` and confirm it returns the attachment metadata.
4. Try inserting a zero width/height or invalid status; it should fail.
5. Confirm attachment queries by `message_id` return ordered records.