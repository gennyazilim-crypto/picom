# Attachment CDN and Signed URL Plan

Picom's MVP uses Supabase Storage and attachment metadata for image uploads. Production delivery may later use CDN-backed public assets or private signed URLs depending on channel privacy, moderation status, and storage policy. This task documents the strategy without changing runtime upload behavior.

## Status

- Runtime behavior change: none
- CDN integration: not enabled
- Signed URL generation: planned, not enabled in renderer
- Existing local/Supabase upload flow: unchanged
- Secrets: not added

## Review conclusion - 2026-07-10

The `message-attachments` bucket is private and must remain private. Supabase migration
`20260704002200_storage_message_attachments_bucket.sql` enforces `public = false`; the latest Storage
SELECT policy in `20260710139000_attachment_scanning_quarantine.sql` serves only clean/development-safe
objects and calls `public.can_view_message()` for attached files. That function follows current channel
visibility, including private-channel role rules. Pending objects remain uploader-only.

The upload path stores an object key and writes `public_url = null`; it does not call `getPublicUrl()` or
persist an expiring signed URL. This is the approved current behavior and must not be replaced with a public
bucket to fix rendering. Historical private attachment reload has no end-to-end signed URL resolver yet, so
the safe production-connected fallback is an unavailable/blocked preview rather than public delivery.

Before historical private attachment rendering can be release-ready, add an authenticated resolver that
accepts an attachment ID, rechecks RLS/message visibility and scan state, returns a short-lived URL with
private/no-store semantics, refreshes after expiry, and redacts query strings from logs/diagnostics. The
hosted staging matrix must prove metadata and object denial after membership/private-channel access loss.

## Goals

- Keep attachment previews fast and safe.
- Preserve private channel access boundaries.
- Prepare for signed URLs without leaking storage admin credentials.
- Define CDN caching rules for thumbnails and full-size images.
- Keep suspicious or quarantined files unavailable.

## Current MVP behavior

Current attachment metadata supports:

- `storage_path`
- `public_url`
- `thumbnail_url`
- `mime_type`
- `size_bytes`
- `width`
- `height`
- `status`

`AttachmentGrid` already prefers `thumbnailUrl` when available and falls back to public/full URLs. Supabase Storage policies and database RLS remain the access control foundation.

## Public vs private attachments

### Public attachments

Public attachments can use stable public URLs only when:

- the community/channel content is public by policy
- the file passed validation
- moderation/scanning status is clean or development-skipped
- no private channel access rule applies

### Private attachments

Private channel attachments should use short-lived signed URLs or guarded delivery:

- signed URL generated server-side or by a safe Supabase client policy path
- expiration is short enough to reduce sharing risk
- URL is refreshed on demand
- signed URLs are not stored in permanent message metadata
- logs never include signed query strings

## Signed URL placeholder contract

A future attachment delivery service can expose:

```ts
export type AttachmentDeliveryRequest = {
  attachmentId: string;
  communityId: string;
  channelId: string;
  messageId: string;
};

export type AttachmentDeliveryUrl = {
  url: string;
  expiresAt: string | null;
  deliveryMode: 'public_url' | 'signed_url' | 'blocked';
};
```

The renderer should receive only the final URL and expiration metadata. It must never receive Supabase service-role keys, bucket admin credentials, or raw storage signing secrets.

## CDN cache behavior placeholder

Future CDN rules:

- thumbnails: cache longer, use immutable object paths when content hash exists
- full images: cache based on privacy mode
- private signed URLs: short cache TTL or no shared cache
- blocked/quarantined files: no CDN delivery
- deleted/replaced attachments: purge or version object paths instead of reusing mutable names

## Thumbnail strategy

Future thumbnail generation should:

- write thumbnails to a predictable sibling object path
- store `thumbnail_url` or thumbnail object key in metadata
- reserve image dimensions to reduce layout shift
- avoid processing unsupported MIME types
- avoid logging image contents or raw paths beyond safe metadata

The prepared object-key convention is `<original-directory>/thumbnails/<original-file-name>.webp`. It remains in the same private community/channel/user namespace as the source object; it is never promoted to a public bucket by naming alone. See [Attachment thumbnail pipeline](attachment-thumbnail-pipeline.md).

## Validation and scanning

Before public or signed delivery:

- file name is sanitized
- MIME type is allowed
- file extension matches allowed type
- size is within max limit
- optional malware scan status is clean, skipped in development, or explicitly allowed by config
- suspicious/failed scan states are blocked

## Private channel access rules

Attachment access must match message access:

- user must be authenticated where required
- user must be a community member where required
- user must be able to view the channel
- private channel rules apply before URL issuance
- deleted or inaccessible messages should not produce delivery URLs

## Storage provider notes

Supabase Storage remains the MVP provider. If an S3-compatible provider is introduced later, the provider interface should support:

- `getPublicUrl()`
- `getSignedUrlPlaceholder()`
- `deleteFile()`
- `generateThumbnailPlaceholder()`

These methods must be server-side or safely abstracted when credentials are required.

## Operational risks

- Public URLs can leak private channel attachments if storage policy is too broad.
- Signed URLs can leak through logs, screenshots, diagnostics, or support bundles.
- CDN caching can keep deleted or quarantined files available if purge/versioning is missing.
- Thumbnail generation can create orphaned files if message send fails.
- Virus scanning delays can make attachments appear broken without clear UI states.

## Verification checklist

- Attachment delivery does not bypass Supabase RLS/storage policies.
- Signed URLs are short-lived and not persisted as permanent metadata.
- Private channel attachments require channel visibility checks.
- Suspicious or failed scan attachments render as blocked/unavailable.
- Logs and diagnostics redact signed query strings.
- CDN cache policy is different for public thumbnails and private files.

## Rollback plan

If CDN or signed URL delivery causes privacy or availability issues:

1. Disable CDN delivery or signed URL feature flag.
2. Fall back to existing Supabase Storage public/private policy behavior.
3. Purge affected CDN objects if leaked or stale.
4. Rotate any exposed signing configuration in provider secret storage.
5. Keep chat metadata intact while storage delivery is corrected.

## Test steps

This task is documentation-only. Run:

```bash
npm run attachment-delivery:smoke
npm run typecheck
npm run qa:smoke
npm run build
```

Manual review:

1. Confirm signed URL secrets are not stored in renderer config.
2. Confirm private channel rules are documented before URL issuance.
3. Confirm CDN caching and quarantine behavior are explicitly covered.
4. Confirm no runtime upload code was changed in this task.
