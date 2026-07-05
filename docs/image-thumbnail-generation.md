# Image Thumbnail Generation Placeholder

Picom's current MVP upload flow stores original image attachments in Supabase Storage and renders them through `AttachmentGrid`. This task prepares the thumbnail metadata path without adding a heavy renderer-side image processing dependency.

## Current behavior

- `AttachmentGrid` prefers `thumbnailUrl` when present.
- If no thumbnail exists, it falls back to `publicUrl` and then local preview `url`.
- `ImagePreviewModal` continues to use the full image URL, not the thumbnail URL.
- Upload metadata can carry optional `thumbnailUrl`, `width`, `height`, and `blurhashPlaceholder` fields.

## Placeholder service

`src/services/attachmentThumbnailService.ts` exposes:

- `createThumbnailPlaceholder()`
- `generateThumbnailPlaceholder()`

Both currently return a safe placeholder result:

```ts
{
  thumbnailUrl: null,
  thumbnailStoragePath: "...thumbnail-placeholder",
  width: null,
  height: null,
  blurhashPlaceholder: null,
  generated: false,
  reason: "IMAGE_PROCESSOR_NOT_CONFIGURED"
}
```

## Why no processor yet

No `sharp`, ImageMagick, Canvas, or native image processing dependency is introduced in this task because thumbnail generation should run in a controlled backend/Edge Function/storage worker path, not inside the Electron renderer.

## Future production flow

1. User uploads original image through `uploadService`.
2. Storage worker or Edge Function validates MIME/size again.
3. Worker generates a small thumbnail object near the original object path.
4. Worker stores:
   - `thumbnail_url`
   - `width`
   - `height`
   - optional blurhash/preview placeholder field if the database schema adds it
5. Renderer receives safe DTO metadata and `AttachmentGrid` uses the thumbnail first.
6. `ImagePreviewModal` opens the full image URL after access checks.

## Safety notes

- Do not generate thumbnails by executing uploaded files.
- Do not expose raw local file paths.
- Private-channel thumbnails must follow the same access rules as full attachments.
- Suspicious or quarantined files should not receive public thumbnail URLs.
- CDN caching rules for thumbnails are documented separately in `docs/attachment-delivery.md`.

## Manual test steps

1. Run mock mode.
2. Attach and send an image.
3. Confirm the image still renders in `AttachmentGrid`.
4. Click the image and confirm `ImagePreviewModal` opens the full image.
5. In API mode, confirm attachment metadata can carry null thumbnail/dimension fields without crashing.

## Remaining work

- Add a backend/Edge Function thumbnail worker after storage access policy is final.
- Add database field for `blurhashPlaceholder` only if the product chooses blurhash previews.
- Backfill dimensions for existing attachments if needed before beta.
