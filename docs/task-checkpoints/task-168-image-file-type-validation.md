# Task 168 Checkpoint: Validate image file types

## Completed

- Exported allowed image MIME type set.
- Added allowed image extension set.
- Updated `fileService.validate()` to check both MIME type and extension.
- Documented validation rules and security notes.

## Changed files

- `src/services/fileService.ts`
- `docs/image-file-type-validation.md`
- `docs/task-checkpoints/task-168-image-file-type-validation.md`

## Verification

Run:

```bash
npm run typecheck
npm run build
```

Manual test: attach allowed and disallowed image files through the composer preview flow.