# Image thumbnails — Approach B (native preview)

Picom Feed and message cards do **not** run a production thumbnail processor in the Electron renderer.

## Production policy (this package)

- Upload still stores originals in Supabase Storage bucket `message-attachments`.
- `attachmentThumbnailService.createNativePreviewMetadata()` returns `thumbnailUrl: null` and `processor: "NATIVE_ORIGINAL_PREVIEW"`.
- No fake/placeholder thumbnail URL is written into metadata or the Feed UI.
- `AttachmentGrid` / Feed cards call `resolveNativeImagePreviewUrl()`:
  1. use real `thumbnail_url` when Storage/metadata eventually provides one
  2. otherwise use the scanned original `public_url` / `url`
- Images load with `loading="lazy"` and `decoding="async"`.
- Broken images show a dedicated fallback state (no crash).
- `ImagePreviewModal` opens the full original after quarantine checks, with gallery next/previous.

## Why not Approach A yet

No `sharp`, ImageMagick, Canvas, or native image processing dependency is introduced in the renderer. A future Edge Function / storage worker may write real `thumbnail_url` values; the client path already prefers them when present.

## Image validation (existing)

- MIME allowlist: PNG, JPEG, WEBP, GIF (`fileService.allowedImageMimeTypes`)
- Extension allowlist aligned with MIME
- Max size: 10 MB
- Magic-byte validation on upload (`fileService.validateContent`)
- SVG is not in the allowlist
- Quarantine / scan gate via `attachmentQuarantineService`

## Video

Feed cards currently project **image** attachments only from `list_mention_feed`. Video transcoding is **not** implemented; unsupported video kinds stay outside the image grid.

## Safety

- Do not generate thumbnails by executing uploaded files.
- Do not invent thumbnail URLs when the processor is unavailable.
- Private-channel media follows message RLS / storage policies.
- Suspicious or quarantined files do not render.
