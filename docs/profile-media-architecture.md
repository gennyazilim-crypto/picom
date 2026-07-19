# Profile Media Architecture

Picom now treats profile avatar and cover media as one domain instead of passing permanent image URLs through feature components.

## Source of truth

- profiles stores avatar_path, avatar_thumbnail_path, avatar_version, avatar_content_hash, avatar_updated_at.
- profiles stores the equivalent cover fields plus profile_media_updated_at.
- avatar_url and profile_details.cover_url remain read-only transition inputs for old records. New writes clear them.
- get_profile_media_v1 is the privacy-aware read boundary.
- commit_profile_media_v1 and remove_profile_media_v1 are the only metadata write boundaries.

## Runtime layers

- profileMediaImage.worker validates signatures, decodes, crops, rotates, resizes, converts to WebP, creates thumbnails, and hashes output away from the renderer thread.
- profileMediaUploadService uploads immutable objects with real XHR progress, commits atomically, rolls back failed uploads, and removes superseded objects after commit.
- profileMediaResolver obtains short-lived signed URLs and appends the database version as a cache key.
- profileMediaStore is normalized by user ID and rejects stale versions.
- profileMediaRealtimeService owns one profiles subscription and refreshes tracked users after reconnect.
- UserAvatar and ProfileCover own loading, fallback, error, and rendering behavior.
- MemberAvatar delegates to UserAvatar, covering existing feed, DM, community, voice, notification-adjacent, and admin surfaces without per-feature URL logic.

## Failure behavior

An upload never changes active metadata until both objects exist. A metadata conflict removes the newly uploaded objects. Old active objects are removed only after a successful commit. Missing or unauthorized images fall back to initials or the default cover and do not retry in a render loop.
