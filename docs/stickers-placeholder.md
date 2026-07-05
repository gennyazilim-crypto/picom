# Stickers Placeholder

Status: post-MVP placeholder

Stickers are planned as a future expressive media feature for Picom. This placeholder documents the safe architecture without adding a sticker marketplace, copyrighted assets, or runtime sticker picker to the MVP desktop app.

## MVP stance

- Stickers are not enabled in the current MVP runtime.
- Existing image attachments, emoji, reactions, replies, and message sending stay unchanged.
- No third-party or copyrighted sticker assets are bundled.
- No marketplace, paid packs, or external asset fetching is introduced.

## Future data model placeholder

A future `community_stickers` table can use safe fields:

- `id`
- `community_id`
- `name`
- `image_url`
- `storage_path`
- `created_by_id`
- `created_at`
- `deleted_at`

Sticker message metadata can reference a sticker by `sticker_id` and should not duplicate large binary payloads in message rows.

## Asset rules

Future stickers must follow the same safety model as uploads:

- only use assets the project owns or has explicit rights to use
- allow safe image types only: png, jpg, jpeg, webp, gif
- reject SVG until a sanitizer exists
- enforce max file size from config
- sanitize file names and storage paths
- block suspicious or failed scan states

## Supabase storage placeholder

Potential path pattern:

`communities/{communityId}/stickers/{stickerId}/{safeFileName}`

Storage and RLS rules should ensure only permitted users can manage community stickers.

## Future UI placeholder

Potential desktop UI entry points:

- MessageComposer sticker button, hidden behind a feature flag
- StickerPicker compact popover
- Community Settings > Stickers
- Sticker delete confirmation for permitted users

The UI must remain compact and desktop-native. It must not add mobile bottom sheets or mobile navigation.

## Message rendering placeholder

Future sticker messages should render as compact media cards with:

- sticker image
- author/timestamp like normal messages
- fallback text if the sticker is deleted
- blocked state if the asset fails scan or is quarantined

## Permissions

Managing stickers should require a future permission such as:

- `manageStickers`
- `manageCommunity`
- owner/admin override

Sending stickers should require normal message send permission in the target channel.

## Security and privacy

- Do not execute sticker files.
- Do not expose raw storage paths that bypass access checks.
- Do not log uploaded sticker payloads.
- Do not track sticker image content in analytics.
- Do not allow external untrusted sticker URLs as first-class sticker assets.

## Implementation decision

This task is documentation-only. Runtime UI, storage, schema, and picker behavior are intentionally unchanged until stickers become an active milestone.

## Manual verification

- Confirm existing attachment and emoji flows still work.
- Confirm no new sticker picker or settings panel appears in the MVP UI.
- Confirm no copyrighted sticker assets were added.
