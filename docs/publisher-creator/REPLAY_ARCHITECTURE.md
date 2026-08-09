# Replay Architecture

## Entity
`publisher_replays` references a READY `publisher_recordings` row.

## Visibility
- PUBLIC — published + discoverable when moderation VISIBLE
- UNLISTED — owner-only until share-token model exists (UUID obscurity rejected)
- PRIVATE — owner only

## Playback
`create_publisher_replay_playback_url` returns storage claim; Edge mints bounded signed URL (TTL 60–900s).
Signed URLs are never persisted in DB.

## States
DRAFT → PROCESSING → READY → PUBLISHED/UNLISTED/PRIVATE → ARCHIVED | TAKEDOWN | DELETED

## Captions
AUTOMATIC_CAPTIONS: NOT_IMPLEMENTED

## Analytics hooks
Extensible for future REPLAY_* events; not required for TASK30 recording core.
