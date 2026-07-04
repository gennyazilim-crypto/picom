# Task 177 Checkpoint - Clipboard Paste Image Placeholder

## Completed

- Added a small clipboard file extraction helper for the message composer.
- Paste now supports both:
  - `clipboardData.files`
  - file entries exposed through `clipboardData.items`
- Pasted files reuse the existing image validation, preview, upload, and metadata flow.
- Text paste behavior remains unchanged when no file exists in the clipboard.
- Unsupported pasted files still show the same clear validation error toast.

## Manual verification

1. Copy an image to the clipboard from a screenshot tool or image viewer.
2. Focus the message composer.
3. Press Ctrl+V.
4. Confirm an attachment preview appears.
5. Send the message and confirm the image renders in the AttachmentGrid.
6. Paste normal text and confirm text paste still works normally.

## Notes

- This is an MVP placeholder for image paste only.
- Clipboard native APIs remain outside React components; this path uses the browser paste event safely.