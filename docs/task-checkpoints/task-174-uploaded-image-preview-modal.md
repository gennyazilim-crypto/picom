# Task 174 Checkpoint - Uploaded Image Preview Modal

## Completed

- Reused the existing desktop-native `ImagePreviewModal` instead of adding a second modal system.
- The modal now opens the full uploaded `publicUrl` when available.
- Local preview URLs remain as a safe mock/development fallback.
- Added compact metadata text so uploaded images are distinguishable from local previews.
- Kept Escape/outside-click close behavior and Coolicons close control.

## Manual verification

1. Send a message with an image attachment.
2. Click the image in `AttachmentGrid`.
3. Confirm the preview modal opens.
4. In Supabase mode, confirm uploaded images use the Storage public URL when available.
5. Confirm Escape and outside click close the modal.

## Notes

- This task does not add image zooming, download controls, or a gallery carousel.
- This task stays scoped to rendering uploaded image previews for the MVP chat UI.