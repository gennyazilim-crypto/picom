# Profile Media Cache Strategy

Database path plus monotonic version is the canonical cache identity. Signed URLs are short-lived delivery credentials, not stored profile state.

- Signed URL lifetime: 60 minutes.
- Resolver refresh headroom: 2 minutes.
- Browser cache key: signed URL plus v={databaseVersion}.
- Object cache control: immutable, one year, because paths contain the version.
- Avatar list surfaces prefer thumbnails.
- Full profile cover uses the processed main cover.
- Visible components load lazily by default; current/edit previews can request eager loading.
- Failed image elements fall back once and do not cause retry loops.
- Realtime invalidation clears only delivery URLs and preserves metadata until refresh.

The Electron notification avatar cache already includes avatarVersion in its cache key. A profile-media-updated browser event is also emitted so future native consumers can invalidate without importing renderer state.
