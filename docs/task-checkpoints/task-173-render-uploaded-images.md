# Task 173 Checkpoint - Render Uploaded Images in AttachmentGrid

## Completed

- Attachment DTO now supports optional uploaded image metadata:
  - `publicUrl`
  - `thumbnailUrl`
  - `storagePath`
  - `mimeType`
- Supabase uploads now resolve a Storage public URL after upload.
- Message composer prefers uploaded public URLs for sent image attachments and falls back to local preview URLs in mock/dev flows.
- AttachmentGrid renders image sources in this safe order:
  1. thumbnail URL
  2. uploaded public URL
  3. local attachment URL
- Image rendering keeps lazy loading and now uses async decoding.

## Manual verification

1. Start the app in mock mode and send a message with an image attachment.
2. Confirm the image renders in the message AttachmentGrid.
3. Start in Supabase mode with Storage configured.
4. Send an image attachment and confirm the grid renders the uploaded Storage URL when available.
5. Click the image and confirm the existing image preview still opens.

## Notes

- This task does not introduce thumbnail generation.
- This task does not link pending attachment rows to saved backend message ids yet.