# Community Sticker Pack Management

Picom supports community-owned sticker packs through Community Settings. No marketplace, paid catalog, public publishing, or remote third-party pack import is enabled.

## Ownership and permissions

Each pack belongs to one community and records the manager who created it. Community management permission is required to create, upload, disable, or delete pack content. Renderer checks are UX only; Supabase table and Storage RLS enforce permission. Pack names and sticker names are unique within their community scope.

## Upload safety

- PNG, JPEG, WEBP, and GIF only; SVG is rejected.
- 2 MB maximum file size.
- Extension, MIME, and binary signature validation occurs before upload.
- Random IDs form object paths; user file names are never trusted.
- Assets use a private Storage bucket and short-lived signed URLs.
- Packs and stickers can be disabled without losing moderation evidence.

## Asset rights

No copyrighted sample stickers, Discord assets, marketplace packs, or unlicensed third-party art are bundled. Existing Picom mock cards are original token-based placeholders rather than copied image assets. Community managers remain responsible for upload rights; future reporting/moderation can disable unsafe packs.

## Product boundary

Community Settings provides pack creation and upload management. The existing compact desktop sticker picker remains stable. Marketplace discovery, monetization, global pack publishing, and arbitrary external URLs are out of scope.
