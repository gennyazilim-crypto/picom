# Task 65 - Custom Emoji and Stickers Foundation

- Added RLS-ready community emoji and sticker schemas with safe normalized unique names.
- Reused image MIME/extension validation and added a 512 KB custom emoji limit.
- Added Community Admin Panel > Emojis upload placeholder and confirmed soft delete.
- Added community emoji entries to composer and reaction pickers using `:emoji_name:` format.
- Added six original local Picom sticker placeholders and compact sticker message rendering.
- Added no marketplace and no external/copyrighted sticker assets.

Validation: `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.
