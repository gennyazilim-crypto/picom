# CDN delivery proof

## Decision and scope

Picom keeps Supabase Storage as the attachment origin and the existing release host as the desktop artifact origin. This proof defines CDN-ready URL and cache behavior without migrating providers, enabling a public bucket, or adding credentials.

The renderer receives only authorized delivery URLs. It never receives service-role keys, signing keys, storage admin credentials, CDN purge credentials, or origin secrets.

## Delivery classes

| Class | Origin/access model | CDN eligibility | Permanent metadata |
| --- | --- | --- | --- |
| Public community attachment | Supabase object confirmed public by community/channel policy, clean scan state, visible message | Optional public CDN | Stable object key; public URL only when policy explicitly allows it |
| Private/member attachment | Private Supabase bucket plus server-authorized signed URL | Private CDN only, short TTL, no shared caching | Object key only; never the signed URL |
| Thumbnail | Same visibility and scan policy as source | Same or stricter than source | Thumbnail object key, dimensions, processor version |
| Quarantined/pending attachment | Private quarantine/pending namespace | Never | Object key and restricted scan state only |
| Windows/Linux/macOS release artifact | Approved immutable release origin | Public CDN | Versioned artifact name, checksum, provenance |
| Release metadata/checksums | Approved immutable release origin | Public CDN with short revalidation | Versioned manifest |

## URL issuance proof

### Public attachment path

Public delivery is permitted only when all are true:

1. community visibility is public;
2. community public read is enabled;
3. channel is not private and public read is enabled;
4. message is visible and not access-restricted;
5. attachment belongs to that message;
6. scan state is `clean` (or the explicitly isolated development state outside production);
7. attachment is not deleted, quarantined, or under a block/hold.

The current RLS/storage policies remain authoritative. CDN configuration cannot make an otherwise private object public.

### Private/signed path

For member-only/private content, a future server/Edge Function:

1. authenticates the user;
2. checks community membership, channel visibility, message access, attachment linkage, deletion state, and clean scan state;
3. creates a short-lived signed URL;
4. returns `url`, `expiresAt`, and delivery mode only;
5. omits the URL and query string from logs, analytics, diagnostics, and permanent database rows.

The client refreshes near expiry and treats authorization failure as blocked, not as a public-URL fallback. A signed URL is a bearer capability; screenshots, clipboard, browser history, support bundles, and referrers are leakage risks.

## Cache headers

Recommended policies use versioned/content-addressed object keys:

| Resource | Recommended header | Notes |
| --- | --- | --- |
| Public immutable image/thumbnail | `Cache-Control: public, max-age=31536000, immutable` | Only content-addressed/versioned names; never overwrite |
| Public metadata that may change | `Cache-Control: public, max-age=60, stale-while-revalidate=300` | ETag/Last-Modified required |
| Private signed attachment/thumbnail | `Cache-Control: private, max-age=60, no-store` at application response; CDN shared cache disabled unless authenticated token partitioning is proven | Prefer origin authorization per request |
| Quarantine/pending/error response | `Cache-Control: no-store` | Never cache a future allow/deny decision |
| Versioned desktop installer/package | `Cache-Control: public, max-age=31536000, immutable` | File name includes version/platform/architecture |
| Latest release pointer/manifest | `Cache-Control: public, max-age=60, must-revalidate` | Must not pin clients to stale release state |
| Checksums/provenance for versioned release | `Cache-Control: public, max-age=31536000, immutable` | Published atomically with artifacts |

Do not use `Access-Control-Allow-Origin: *` for private signed delivery unless the complete threat model proves it safe. App artifact CORS is independent from private attachment CORS.

## Invalidation and deletion

- Prefer immutable, versioned object paths; replacement creates a new key and updates metadata atomically.
- Deletion, quarantine, permission revocation, community privacy change, attachment replacement, or legal removal enqueues purge for full object and all derivatives.
- CDN purge failure is retried with an idempotency key and monitored. The origin authorization/storage policy blocks access even while a stale edge object is being purged.
- Signed URLs cannot always be revoked individually. Use short TTLs, object versioning/removal, signing-key emergency rotation, and authorization-at-edge/origin where supported.
- Never reuse a purged private object key for different content.
- Release artifacts are immutable and are not silently replaced. A bad release is withdrawn via manifest/rollout status and superseded by a new version; checksums and provenance remain consistent.

## Private-channel leakage tests

Run in an isolated Supabase staging project with two communities, a public channel, a private channel, an authorized member, an unrelated authenticated user, and an anonymous client:

1. Authorized member can obtain a private URL only for a visible clean attachment.
2. Unrelated and anonymous users cannot list, read, transform, thumbnail, or sign the private object.
3. A public-channel URL cannot be manipulated to address a private object key.
4. Pending, suspicious, failed, deleted, and orphaned objects return no usable delivery URL.
5. Revoking membership prevents refresh and origin access immediately; existing signed URL expires within the documented TTL.
6. CDN cache keys include all authorization-relevant partitioning or private shared caching remains disabled.
7. Logs, error responses, support exports, and analytics contain no signed query strings/private paths.
8. Thumbnail and full-image policies return identical allow/deny decisions.

Supabase CLI/RLS tests are required before production enablement. Local source-marker smoke checks do not prove a deployed policy.

## Desktop artifact delivery proof

- Build names include product, version, platform, architecture, and extension.
- SHA-256 checksum and provenance manifest are produced from the exact immutable bytes delivered.
- Windows, Linux, and macOS artifacts are uploaded once under versioned keys.
- Release manifest references those versioned keys and expected hashes.
- CDN/origin supports byte ranges and correct content type/disposition without content sniffing.
- A clean machine downloads, verifies, installs/launches, and reports the same version/provenance.
- No updater signing key or CI secret is embedded in URLs, manifests, logs, or renderer assets.

Production auto-update remains out of scope; artifact CDN readiness does not enable it.

## Rollout and rollback

1. Prove public artifacts first; attachments remain on current Supabase delivery.
2. Enable public attachment CDN for a non-sensitive test community behind remote config.
3. Compare error rate, cache hit ratio, stale content, purge latency, and origin load using aggregate metrics.
4. Keep private signed delivery on origin until authorization and no-shared-cache tests pass.
5. Roll back by disabling CDN URL issuance; metadata object keys and current Supabase origin flow remain unchanged.
6. A privacy leak triggers the incident-response path, CDN purge, URL issuance disablement, signing credential rotation where applicable, and access-log preservation.

## Current evidence and remaining blockers

Current repository evidence:

- private `message-attachments` storage model;
- scan-state Storage gate;
- message/channel visibility checks;
- frontend quarantine enforcement;
- thumbnail-first/full-image fallback contract;
- checksum and provenance documentation/scripts.

Remaining before production CDN enablement:

- deployed staging RLS/storage tests;
- approved CDN vendor/configuration and data region;
- signed URL issuer and redaction verification;
- cache-key/purge integration;
- artifact clean-machine download/install proof;
- monitoring, budget, incident ownership, and privacy/legal approval.

## Local checks

- `npm run attachment-delivery:smoke`
- `npm run attachments:scan:smoke`
- `npm run attachments:quarantine:smoke`
- `npm run thumbnails:smoke`
