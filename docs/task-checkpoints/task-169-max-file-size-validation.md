# Task 169 Checkpoint: Validate max file size

## Completed

- Exported `maxImageFileSizeBytes` from `fileService`.
- Updated client-side image size validation to 10 MB.
- Aligned client validation message with Supabase bucket limit.
- Documented max file size behavior.

## Changed files

- `src/services/fileService.ts`
- `docs/max-file-size-validation.md`
- `docs/task-checkpoints/task-169-max-file-size-validation.md`

## Verification

Run:

```bash
npm run typecheck
npm run build
```

Manual test: attach an image over 10 MB and confirm the composer rejects it before upload.