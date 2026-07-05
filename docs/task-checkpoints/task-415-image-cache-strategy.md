# Task 415 - Image Cache Strategy

## Status

Implemented.

## Scope

- Added `imageCacheService` as a bounded, metadata-only image cache helper.
- Added `docs/image-cache-strategy.md`.
- Added `image-cache:smoke` quality command.

## Safety Notes

- The helper does not download, persist, or store image bytes.
- Private attachment thumbnails/full images are refused by default.
- Signed URLs must not be treated as permanent cache keys.
- Object URL cleanup remains the responsibility of the component that created the object URL.

## Manual Test

1. Run `npm run image-cache:smoke`.
2. Launch Picom and confirm avatars still render.
3. Open a message with image attachments and confirm thumbnails/images still render.
4. Confirm clearing future cache metadata would not clear auth sessions or drafts.
