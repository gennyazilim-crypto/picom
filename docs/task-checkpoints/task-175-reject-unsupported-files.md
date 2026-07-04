# Task 175 Checkpoint - Reject Unsupported Files with Clear Error

## Completed

- Added typed file validation result codes:
  - `UNSUPPORTED_MIME_TYPE`
  - `UNSUPPORTED_EXTENSION`
  - `FILE_TOO_LARGE`
- Kept user-facing rejection messages concise and clear in the composer toast.
- Added redacted developer diagnostics through `loggingService.logWarn()` when a file is rejected before preview.
- Logged only safe metadata:
  - validation code
  - MIME type
  - file size
- Avoided logging file names, tokens, passwords, cookies, auth headers, or secrets.

## Manual verification

1. Open Picom and try attaching a `.txt` or `.pdf` file.
2. Confirm the composer shows a clear unsupported-file error toast.
3. Try attaching a renamed unsupported extension.
4. Confirm extension validation rejects it.
5. Try attaching an image larger than 10 MB.
6. Confirm the size-limit message appears.
7. Attach a PNG/JPG/WEBP/GIF under 10 MB and confirm preview still works.

## Notes

- The upload service still re-validates before upload, so UI validation is not the only enforcement point.
- This task does not add support for non-image files.