# Image Thumbnail Generation

## Ready path

Picom's safe attachment contracts support optional `thumbnailUrl`, full `url`, width, height, blurhash placeholder, and scan status in both runtime and shared DTOs. `AttachmentGrid` prefers the thumbnail and falls back to the full/local URL. `ImagePreviewModal` intentionally uses the full URL and independently rechecks quarantine before rendering.

No heavy image processor is installed in the Electron renderer. Local/mock development uses original generated-safe images and a metadata placeholder. Supabase production uploads remain pending/unserved until the scanning pipeline from Task 139 marks them clean.

## Backend generation workflow

1. Upload original to a private pending object path and insert metadata as `pending`.
2. Trusted scanner validates and marks the original `clean`.
3. A queue/worker receives an idempotent job containing attachment ID/object reference, never a local desktop path.
4. Worker reads with least-privilege service credentials, decodes with strict resource limits, verifies actual image format, strips unsafe metadata according to policy, and generates approved variants.
5. Write content-addressed sibling objects, for example `thumbnails/<attachment-id>/<source-hash>-w640.webp`.
6. Atomically store thumbnail object key, width, height, format, source hash/version, and job status.
7. Delivery endpoint issues a public or short-lived private URL only after current parent-message/channel and scan checks.

Do not generate a thumbnail before clean scan state. A thumbnail is derived private content and inherits deletion, quarantine, legal/retention, tenant, region, and channel visibility from the original.

## Processor limits

- Backend worker only; never React/Electron renderer or arbitrary desktop process.
- Allowlisted decoders/formats; no script, macro, shell, or uploaded executable execution.
- Maximum encoded bytes, decoded pixels, width/height, frames, animation duration, CPU, memory, wall time, concurrency, and retry count.
- Decompression-bomb and malformed-file handling.
- Orientation normalization and metadata stripping reviewed for privacy.
- Output dimensions/quality bounded; no upscaling by default.
- Idempotent object keys and jobs prevent duplicate cost/storage.

Sharp/libvips, ImageMagick, or a managed image service may be evaluated in the backend only after dependency/security/license/platform review. No dependency is selected by this task.

## Variants and metadata

Initial recommended static variant is a maximum 640 px edge in WebP or original-safe fallback. Animated GIF policy requires separate cost/product review; do not silently convert animation in a way that changes meaning. Preserve original separately for authorized preview.

Metadata should store object keys rather than permanent private signed URLs. `width` and `height` reserve layout space and reduce shift. A blurhash-like placeholder is optional and must not be generated/stored if it creates unacceptable private-content leakage.

## Delivery and cache

- Grid requests thumbnail delivery; preview requests full original delivery.
- Both paths enforce clean scan and current authorization.
- Private thumbnail URLs are short-lived and non-shared-cacheable by default.
- Public thumbnails require explicit public policy and versioned immutable keys.
- Visibility/quarantine/deletion changes purge thumbnail and original CDN entries.
- Renderer refreshes expired URLs through a trusted service, not by exposing signing credentials.

## Failure states

Pending generation may temporarily fall back to an authorized full image only if product/performance policy permits; quarantine never falls back. Generation failure shows a safe unavailable/original placeholder, records bounded job metadata, and retries with limits. Orphan variants are removed by a guarded reference-aware cleanup job.

## Verification

Run `npm run thumbnails:smoke`, `npm run attachments:scan:smoke`, `npm run attachments:quarantine:smoke`, `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.

Production staging must test clean versus pending/suspicious/failed, private channel and removed membership, thumbnail/full URL separation, expiry refresh, dimensions/layout shift, malformed/decompression bomb inputs, animation/orientation, source replacement/hash invalidation, CDN purge, orphan cleanup, and worker resource limits.

## Remaining work

Implement the trusted worker, job/status schema, object-key metadata, delivery endpoint, processor selection, CDN behavior, and live authorization tests. The current code is ready to consume thumbnails but does not generate production image derivatives.
