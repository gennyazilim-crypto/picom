# Attachment thumbnail pipeline

## Current contract

Picom carries optional `thumbnailUrl`, `width`, `height`, and `blurhashPlaceholder` fields through runtime attachments and the shared safe DTO. `AttachmentGrid` prefers `thumbnailUrl`, then the full/public/local URL. `ImagePreviewModal` intentionally uses the full image and rechecks quarantine access.

The current upload path does not process pixels. `attachmentThumbnailService` returns a typed `EDGE_FUNCTION_PLACEHOLDER` result and a deterministic future private object key:

```text
<original-directory>/thumbnails/<original-file-name>.webp
```

The helper rejects empty, dot, parent-traversal, or malformed path segments and only prepares paths for PNG, JPEG, WebP, and GIF input.

## Preferred production flow

1. Upload the validated source into the private `message-attachments` bucket under its community/channel/user namespace.
2. Create pending attachment metadata; do not expose the source while scanning is pending.
3. A server-side Supabase Edge Function or trusted worker receives an authenticated job/reference, not arbitrary renderer credentials.
4. Re-authorize attachment access and verify the scan state before reading the object.
5. Decode with a maintained, sandboxed image processor and enforce pixel, memory, CPU, and output-size limits.
6. Strip metadata, correct orientation, and write a bounded WebP derivative to the prepared sibling object key.
7. Store an object key or stable private metadata reference, not an expiring signed URL.
8. Serve the derivative through the same RLS/storage authorization and quarantine checks as the original.

No `sharp`, ImageMagick, Canvas, native codec, or other heavy image dependency is added to the Electron renderer by this task.

## CDN and access limitations

- A thumbnail is as sensitive as its original. Private-channel thumbnails must never use a public CDN origin.
- Signed URLs must be short-lived, generated after access checks, omitted from permanent metadata, and redacted from logs.
- Public thumbnails may use long-lived immutable caching only after scan/visibility approval and content-addressed versioning.
- Deleted, quarantined, or permission-revoked attachments require derivative invalidation/purge.
- Animated GIF input may produce a static first-frame derivative; behavior must be disclosed before production enablement.
- Width/height and blurhash-like previews can leak visual metadata and need the same privacy review.
- Placeholder URLs remain `null` until trusted processing succeeds; the frontend safely falls back to the full authorized URL.

## Failure and cleanup

- Generation failure must not make the source attachment unreadable when the source is otherwise authorized and clean.
- Failed jobs remain retryable with bounded attempts and redacted error codes.
- Orphan cleanup must cover both original and `/thumbnails/` objects.
- A derivative must never outlive a deleted source or bypass suspicious/failed scan states.

## Verification

- `npm run thumbnails:smoke`
- `npm run attachment-delivery:smoke`
- `npm run attachments:scan:smoke`
- `npm run attachments:quarantine:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
