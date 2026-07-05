# App Icons

Task 253 sets Picom app icon assets for desktop packaging.

## Brand app icon assets

- Source/logo concept: `assets/brand/picom-logo-concept.png`
- Runtime/package PNG: `assets/brand/app-icon.png`
- SVG placeholder: `assets/brand/app-icon.svg`
- Windows ICO: `assets/brand/app-icon.ico`
- Linux PNG sizes: `assets/brand/icons/`

Generated Linux PNG sizes:

- 16 x 16
- 32 x 32
- 64 x 64
- 128 x 128
- 256 x 256
- 512 x 512
- 1024 x 1024

## Packaging usage

- Windows uses `assets/brand/app-icon.ico`.
- Linux uses `assets/brand/icons`.
- macOS currently references `assets/brand/app-icon.png` as a placeholder. Generate final `.icns` before production release.

## UI icon system

Picom app/logo icons are brand assets. UI glyphs must continue to use the approved Coolicons Free icon set through `AppIcon` and the semantic icon registry.

Coolicons attribution remains in `THIRD_PARTY_NOTICES.md`.

## Rules

- Do not use Discord icons, logos, copied assets, or exact colors.
- Do not mix random UI icon libraries into the MVP shell.
- Icon-only buttons must keep accessible labels.
- SVG/inline UI icons should use `currentColor` so they follow light/dark mode tokens.

## Manual verification

1. Run `npm run build`.
2. Confirm `assets/brand/app-icon.ico` exists.
3. Confirm `assets/brand/icons/256x256.png` exists.
4. Confirm Windows packaging points to the `.ico`.
5. Confirm Linux packaging points to the generated icon directory.
6. Confirm Coolicons attribution remains present in `THIRD_PARTY_NOTICES.md`.
