# Attachment Upload Security QA

This document captures the current MVP security posture for Picom image attachments.

## Current controls

- Attachments are limited to MVP image types only:
  - PNG
  - JPEG/JPG
  - WEBP
  - GIF
- MIME type and extension are both validated before preview and before upload.
- Maximum image file size is enforced client-side through `fileService`.
- Upload file names are sanitized before creating Supabase Storage paths.
- Uploads go through `uploadService`; React components do not call Supabase Storage directly.
- Attachment metadata is persisted through `attachmentService`; React components do not insert metadata rows directly.
- Upload metadata logs avoid file names and avoid passwords, tokens, cookies, authorization headers, sessions, and secrets.
- Supabase Storage and database RLS policies are expected to enforce authenticated access and ownership rules.

## Security assumptions

- `message-attachments` is the only MVP bucket used by the renderer upload path.
- Supabase RLS policies reject unauthorized writes and reads.
- The renderer never receives a service-role key.
- Local object URLs are used only for temporary previews and are revoked when previews are removed or the composer unmounts.
- Current MVP attachments are images only; arbitrary file uploads are intentionally out of scope.

## Manual QA checklist

- Upload valid PNG, JPG, JPEG, WEBP, and GIF files under the size limit.
- Try unsupported extensions such as `.txt`, `.pdf`, `.svg`, `.exe`, and `.html`.
- Try mismatched extensions and MIME types where possible.
- Try a file above the configured MVP size limit.
- Confirm rejected files show user-friendly errors.
- Confirm rejected files do not create previews, storage objects, or metadata rows.
- Confirm logs show only safe metadata such as validation code, MIME type, and byte size.
- Confirm no auth token, cookie, password, or session data appears in diagnostics.

## Remaining risks

- Server-side file validation should be added before production; client-side validation is helpful UX but not a security boundary.
- Virus/malware scanning is not implemented for MVP image uploads.
- Thumbnail generation is not implemented yet.
- Pending attachment rows are not yet linked to persisted backend message ids.
- Private attachment access needs signed URL or guarded delivery if the bucket becomes private.
- GIF content can be visually disruptive; moderation/size controls may need tightening later.

## Production follow-up

- Add backend or Edge Function validation for file size, MIME type, extension, and ownership.
- Add malware scanning/quarantine if non-image uploads or public sharing are expanded.
- Add private-channel attachment authorization checks before serving private content.
- Add periodic orphaned upload cleanup after message/attachment linking is complete.