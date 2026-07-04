# Task 176 Checkpoint - Drag and Drop Placeholder

## Completed

- Kept drag/drop scoped to the desktop message composer.
- Added a window-level file drop guard so dropped files do not navigate the Electron renderer away from Picom.
- Composer now explicitly detects file drag events before showing the drop hint.
- Dropped files reuse the existing attachment validation, preview, upload, and metadata flow.
- Unsupported dropped files still show the same clear validation error as manual attachment selection.

## Manual verification

1. Drag a PNG/JPG/WEBP/GIF image over the composer.
2. Confirm the drop hint appears.
3. Drop the image and confirm a preview is created.
4. Drag a non-image file over the composer and drop it.
5. Confirm it is rejected with a clear error toast.
6. Drop a file outside the composer and confirm the app does not navigate away or crash.

## Notes

- This remains an MVP placeholder, not a full upload queue UI.
- Cancel/retry/progress states are intentionally left for later upload reliability tasks.