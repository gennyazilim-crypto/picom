# CDN and Signed URL Attachment Delivery

## Current state

Picom uses a private Supabase Storage bucket and fail-closed scan metadata. New Supabase uploads remain `pending`, receive no signed URL, and cannot be read until a trusted scanner marks them `clean`. `skipped_development` is limited to explicit mock/development fixtures.

No production CDN, attachment delivery Edge Function, signing secret, public attachment bucket, or scanner provider is enabled. This document defines the scalable delivery contract; it does not claim these deferred systems exist.

## Classification

### Private attachments

Private is the default for all community/channel/message attachments. It includes private channels, member-only communities, DMs, pending/quarantined files, and any item without an explicit reviewed public-content policy.

Private delivery requires authentication, current message/channel visibility, clean scan state, non-deleted message/attachment, and a short-lived signed URL issued after those checks. A copied URL may remain usable until expiry, so TTL and revocation/purge are defense-in-depth, not substitutes for authorization.

### Public attachments

A stable public/CDN URL is allowed only when the community and channel are intentionally public-readable, public attachment delivery is explicitly enabled, the message remains public, scan state is clean, moderation/retention allows it, and no private derivative/metadata is exposed. Changing visibility to private must invalidate/purge public delivery before policy state is considered complete.

Picom currently keeps the bucket private and should not persist a public URL for ordinary chat attachments.

## Signed URL issuance

A future trusted delivery endpoint accepts an attachment ID, not a caller-controlled bucket/key. It loads metadata, parent message/channel/community, scan state, deletion/quarantine state, and current user; then applies RLS-equivalent authorization before asking the storage provider for a URL.

Suggested response:

```ts
type AttachmentDeliveryResult = {
  attachmentId: string;
  url: string;
  mode: "signed" | "public";
  expiresAt: string | null;
  thumbnailUrl?: string;
  thumbnailExpiresAt?: string | null;
};
```

Private URL TTL should begin around 5-15 minutes and be tuned after threat/load review. Never store signed URLs in permanent message metadata, local settings, analytics, logs, diagnostics, audit records, crash reports, clipboard history, or CDN keys. Refresh on demand only while access remains valid. Responses use `Cache-Control: private, no-store` unless a reviewed private-CDN design requires otherwise.

## CDN behavior

- Content-addressed/versioned object keys prevent mutable-cache confusion.
- Public clean thumbnails may use longer immutable TTL than full originals.
- Private signed responses are not shared-cacheable by default; CDN must include signature/authorization policy in its cache key and prevent cross-user cache leakage.
- Quarantined/pending/failed/deleted objects return no delivery URL and use no-store error responses.
- Visibility change, moderation block, account/community deletion, scanner reclassification, and legal disposition trigger purge/invalidation workflows.
- Origin access is private; CDN credentials/keys live only in provider secret storage.

Do not put signed query strings or user IDs into metrics labels. Monitor aggregate issuance, denial, expiration refresh, origin error, cache hit/miss, purge lag, and egress only.

## Thumbnails

Thumbnail generation runs after validation and scanning in an isolated backend worker, never in the Electron renderer. It re-validates decoded image limits, strips unsafe metadata as policy requires, bounds dimensions/CPU/memory, writes a sibling content-addressed object, and inherits the original's tenant/channel/privacy/scan/deletion state.

A thumbnail is not automatically public because it is smaller. Private thumbnails need separate short-lived URLs. Suspicious/failed/pending originals have no renderable thumbnail. Store width/height and thumbnail object key, not a permanent private signed URL.

## Storage provider interface

The trusted backend abstraction should be provider-neutral:

```ts
interface AttachmentStorageProvider {
  putPendingObject(input: PendingObjectInput): Promise<StoredObject>;
  getPublicUrl(input: PublicObjectRequest): Promise<string>;
  getSignedUrl(input: SignedObjectRequest & { expiresInSeconds: number }): Promise<{ url: string; expiresAt: string }>;
  deleteFile(input: ObjectReference): Promise<void>;
  generateThumbnailPlaceholder(input: ThumbnailJobInput): Promise<ThumbnailJobResult>;
  purgeCdn(input: ObjectReference): Promise<PurgeResult>;
}
```

The renderer-facing service exposes only attachment IDs and final delivery results. Bucket admin credentials, service-role keys, object-signing keys, origin secrets, and unrestricted raw object paths never cross preload or enter React.

Provider implementations must normalize object keys, reject traversal, enforce bucket/region, use timeouts/retries/idempotency, and produce safe error codes. Deletion and purge are guarded asynchronous operations with audit metadata and orphan reconciliation.

## Private channel and lifecycle rules

- Check access on every URL issuance/refresh; do not trust a search/feed/profile result created earlier.
- Storage SELECT remains scan- and message-visibility-gated even if the delivery endpoint is bypassed.
- Membership removal, ban, channel permission change, message deletion, or session revocation prevents new URLs immediately.
- Existing URLs expire quickly; severe leak/quarantine requires key/object/CDN invalidation.
- Backups and replicas do not become delivery origins and keep region/encryption/retention policy.
- Orphaned pending uploads expire through a guarded cleanup job only after metadata/reference checks.

## Failure and rollback

On authorization uncertainty, scanner outage, CDN misconfiguration, purge lag, or provider error, fail closed and show Attachment unavailable. Core text chat remains available. A remote/backend kill switch can disable attachment issuance/uploads; frontend-only flags are insufficient.

Rollback disables CDN issuance, purges affected cache keys, rotates exposed provider credentials, keeps the bucket private, and returns to direct Supabase signed delivery only after RLS/scan checks pass. Never fall back from private signed delivery to a public URL.

## Verification gates

- Cross-tenant/private-channel/removed-member/deleted-message URL denial.
- Pending/suspicious/failed/quarantined denial at endpoint and Storage policy.
- Short TTL, expiry, refresh authorization, no persistent URL/log leakage.
- Public-to-private transition and purge latency.
- CDN cache-key isolation with two users/tenants.
- Original/thumbnail policy parity and no derivative leak.
- Object traversal, wrong bucket/region, replay, idempotency, provider timeout, and orphan cleanup.
- Windows/Linux/macOS renderer handles expiry/refresh/blocked states without crash.

## Remaining implementation work

Build the trusted delivery endpoint/provider adapter, scanner, thumbnail worker, CDN distribution/origin policy, purge queue, observability, and live RLS/cache tests. Until then Picom's secure behavior is private Storage with pending production uploads unserved.
