# Profile Media Database Migration

Migration 20260719010000_profile_media_centralized_rebuild.sql is forward-only and idempotent.

It adds canonical path, thumbnail path, monotonic version, content hash, and update timestamp columns to profiles. Existing profile-media Storage URLs are converted to paths when possible. External legacy URLs are retained only as transition read fallbacks.

New paths are immutable:

- avatars/{userId}/avatar-{version}.webp
- covers/{userId}/cover-{version}.webp
- thumbnails/avatars/{userId}/avatar-{version}.webp
- thumbnails/covers/{userId}/cover-{version}.webp

The commit RPC locks the profile row, verifies expected_version, validates the exact owner/version path, increments the version, and swaps metadata in one transaction. Concurrent stale writers receive PROFILE_MEDIA_VERSION_CONFLICT.

Rollback procedure: do not reverse the migration after new private paths are in use. Disable new writes, retain the columns/RPCs, restore the previous application build, and keep the bucket private. A separate reviewed forward migration is required for schema changes.
