# Custom Emoji Foundation

Status: post-MVP foundation

Custom community emoji are planned as a future extension of Picom reactions and the EmojiPicker. This foundation documents the safe path without changing the current MVP emoji/runtime behavior.

## MVP stance

- Current MVP keeps the existing standard emoji/reaction behavior.
- Community custom emoji upload and management UI are not enabled yet.
- No marketplace, copyrighted assets, or third-party sticker/emoji packs are introduced.
- No production storage path is required beyond existing attachment upload behavior.

## Future data model placeholder

A future `community_emojis` table can use safe fields:

- `id`
- `community_id`
- `name`
- `image_url`
- `storage_path`
- `created_by_id`
- `created_at`
- `deleted_at`

Do not store secrets, upload tokens, local file paths, or raw private metadata in emoji DTOs.

## Name normalization

Emoji names should be normalized before storage:

- lowercase
- spaces become underscores
- remove unsupported characters
- enforce `^[a-z0-9_]{2,32}$`
- unique per community

Examples:

- `Party Parrot` -> `party_parrot`
- `Picom Fire!` -> `picom_fire`

## Upload validation

Custom emoji upload must reuse the existing attachment validation principles:

- allow safe image types only: png, jpg, jpeg, webp, gif
- reject SVG unless a dedicated sanitizer is added later
- enforce max file size from config
- verify MIME type and extension
- sanitize file names and storage paths
- block suspicious or failed scan states if attachment scanning is enabled later

## Supabase storage placeholder

Future storage path pattern:

`communities/{communityId}/emojis/{emojiId}/{safeFileName}`

RLS/storage policies must ensure:

- only permitted users can upload/delete community emoji
- users can only read emojis for communities they can access if emoji privacy becomes scoped
- deleted emoji are not returned by active emoji list queries

## Future routes/service methods

Potential service methods:

- `listCommunityEmojis(communityId)`
- `createCommunityEmoji(communityId, file, name)`
- `deleteCommunityEmoji(emojiId)`

Potential API/Edge Function routes if needed:

- `GET /communities/:communityId/emojis`
- `POST /communities/:communityId/emojis`
- `DELETE /emojis/:emojiId`

## Permissions

Managing custom emoji should require a future permission such as:

- `manageEmojis`
- `manageCommunity`
- owner/admin override

Emoji use in messages/reactions should still respect channel visibility and message permissions.

## EmojiPicker integration placeholder

Future EmojiPicker grouping:

- Standard emoji
- Community emoji
- Recently used placeholder

Custom emoji reaction payloads should use a stable format, for example:

- standard emoji: `{ type: "unicode", value: "🔥" }`
- custom emoji: `{ type: "custom", emojiId: "...", name: "picom_fire" }`

## Security notes

- Do not allow arbitrary remote image URLs as trusted emoji assets.
- Do not execute or embed unsafe uploaded content.
- Do not expose storage provider secrets to the renderer.
- Do not log raw upload payloads.
- Do not track emoji image content in analytics.

## Implementation decision

This task is documentation-first. Runtime UI and Supabase schema are intentionally unchanged until custom emoji become an active milestone.

## Manual verification

- Confirm standard emoji/reaction behavior still works.
- Confirm no custom emoji management UI appears in MVP surfaces.
- Confirm future implementation follows storage validation and permission rules in this document.
