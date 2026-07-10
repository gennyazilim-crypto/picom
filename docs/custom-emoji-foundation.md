# Custom Emoji Moderation and Storage

Picom supports community-scoped custom emoji through a permission-controlled service and a private bucket in Supabase Storage.

## Upload validation

- Names are normalized to 2-32 lowercase letters, digits, and underscores and are unique per community.
- PNG, JPEG, WEBP, and GIF are allowed; SVG and arbitrary remote URLs are rejected.
- Files are limited to 512 KB and both MIME/extension and binary signature are validated before upload.
- Storage paths are generated from trusted community and random emoji IDs. Original file names never become object paths.
- The `community-emojis` bucket is private. Authorized clients receive short-lived signed URLs.

## Permission and moderation

Only users with community management permission may upload, disable, re-enable, or delete emoji. Renderer checks improve UX, while table and storage RLS enforce the boundary. Names remain unique per community at the database layer.

Unsafe emoji can be disabled immediately without destroying moderation evidence. Disabled and soft-deleted emoji are excluded from normal selection and rendering. Managers can review disabled records. A delete action soft-deletes metadata; later retention cleanup may remove the private object after the audit window.

## Asset policy

Picom provides only original generated placeholders in mock mode. No copyrighted default assets, marketplace packs, Discord assets, or third-party emoji packs are bundled.

## Operational notes

- Production migrations must be applied with the Supabase CLI before API-mode testing.
- Existing legacy rows may have a null `storage_path`; new uploads always provide one.
- Malware scanning can be added before activation; until then strict image validation and management-only upload are required.
- Storage object removal is intentionally separate from soft deletion to preserve safe rollback and review.
