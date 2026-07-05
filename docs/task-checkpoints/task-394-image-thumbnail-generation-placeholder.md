# Task 394: Image Thumbnail Generation Placeholder

## Scope

Prepared the image thumbnail metadata and service placeholder path without introducing a heavy image processing dependency.

## Changed files

- `src/services/attachmentThumbnailService.ts`
- `src/services/uploadService.ts`
- `src/services/attachmentService.ts`
- `src/components/AttachmentGrid.tsx`
- `src/components/MessageComposer.tsx`
- `src/types/community.ts`
- `packages/shared/src/dto/attachment.ts`
- `docs/image-thumbnail-generation.md`
- `scripts/image-thumbnail-placeholder-smoke-test.mjs`
- `docs/task-checkpoints/task-394-image-thumbnail-generation-placeholder.md`
- `package.json`

## Implementation notes

- Added `attachmentThumbnailService` with placeholder generation methods.
- Upload results now carry nullable thumbnail URL, dimension, and blurhash placeholder metadata.
- Attachment metadata mapping now preserves nullable width/height fields already present in the schema.
- `AttachmentGrid` continues to prefer `thumbnailUrl` and now passes width/height attributes when available.
- No runtime thumbnail processing dependency was added.

## Verification commands

```bash
npm run thumbnails:smoke
npm run typecheck
npm run build
```

## Manual test notes

1. Start Picom in mock mode.
2. Attach and send an image.
3. Confirm the attachment renders in the grid.
4. Click the image and confirm the full image opens in the preview modal.

## Remaining work

- Add backend/Edge Function thumbnail generation after storage policy is finalized.
- Decide whether to add a database `blurhash_placeholder` column.
- Add private-channel thumbnail access checks before public release.
