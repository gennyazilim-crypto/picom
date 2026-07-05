# Image Cache Strategy

Picom is a Windows/Linux/macOS desktop community chat app. Image caching should make avatars, community icons, thumbnails, emojis, and stickers feel fast without leaking private media or growing memory forever.

## Current Behavior

- The renderer relies primarily on the browser/Electron HTTP cache for remote images.
- Local mock images and avatarpack fallback images are loaded through normal `<img>` tags.
- Attachment previews use object URLs and are revoked by the composer when removed, sent, or when the composer unmounts.
- `AttachmentGrid` prefers `thumbnailUrl`, then `publicUrl`, then the full local/url fallback.

## Lightweight Cache Helper

`imageCacheService` is a small metadata cache. It does not fetch or persist image bytes.

It can track:

- avatar URLs
- community icon URLs
- attachment thumbnail URLs
- full image preview URLs when safe
- custom emoji URLs
- sticker placeholder URLs

It intentionally:

- caps in-memory entries
- supports invalidation by key or prefix
- refuses private attachment thumbnail/full-image cache entries by default
- avoids storing auth tokens, signed URL secrets, or raw file paths

## Avatar Cache

Avatar caching should use stable keys such as:

- `avatar:{userId}:{updatedAt}`
- `avatar:{userId}:{profileVersion}`

When a user updates their avatar, the cache key should change or the old key should be invalidated.

## Community Icon Cache

Community icons should use stable keys such as:

- `community-icon:{communityId}:{updatedAt}`

When an owner/admin updates the community icon, invalidate the old key.

## Attachment Thumbnail Cache

Attachment thumbnails are safer than full private images, but access rules still matter.

Rules:

- Cache public thumbnails normally.
- Cache member-only thumbnails only while the user has access.
- Do not persist private-channel thumbnails without an access-aware storage layer.
- Invalidate thumbnails if the attachment is deleted, quarantined, or access is revoked.

## Full Image Preview Cache

Full-size attachment images can be sensitive.

Rules:

- Prefer browser/native cache for already-authorized URLs.
- Do not store full image bytes in Picom-managed local storage for MVP.
- Do not cache private full images unless a future access-aware encrypted cache exists.
- Signed URLs should expire and should not be treated as permanent cache keys.

## Custom Emoji Cache

Future custom emoji images can be cached using:

- `emoji:{communityId}:{emojiId}:{updatedAt}`

If an emoji is deleted or renamed, invalidate its key.

## Sticker Cache Placeholder

Sticker caching can follow the same structure as custom emoji:

- `sticker:{communityId}:{stickerId}:{updatedAt}`

No copyrighted external sticker assets should be bundled without rights.

## Invalidation Rules

Invalidate image cache entries when:

- user avatar changes
- community icon changes
- attachment is deleted
- attachment scan status becomes suspicious or failed
- user loses access to a private channel/community
- emoji/sticker is deleted
- signed URL expires

## Memory Growth Controls

- Keep a hard maximum on in-memory entries.
- Prefer URL metadata over image byte storage.
- Revoke object URLs owned by Picom components.
- Do not maintain unbounded arrays of preview URLs.

## Future Native Disk Cache

A native disk cache may be added later through the desktop service layer.

Requirements before implementation:

- access-aware cache keys
- maximum cache size
- clear cache action
- private image exclusion rules
- no auth tokens in filenames or metadata
- safe delete path validation

## QA Checklist

- Avatars still render with fallback images.
- Community icons still render.
- Attachment thumbnails render before full images where available.
- ImagePreviewModal still uses full image URLs.
- Removing/sending composer attachments revokes object URLs.
- Private attachments are not cached by Picom-owned persistent storage.
