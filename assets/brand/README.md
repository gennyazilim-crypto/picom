# Picom App Icon Assets

These are the approved Picom desktop application icon assets for Electron packaging.

## Files

- `picom-logo-mark-v1.png`: approved 2026 Picom P + speech-bubble mark (1024px, transparent outer field).
- `picom-logo-mark-v1.webp`: renderer-optimized primary UI mark (sidebar, title bar, auth, dashboard).
- `app-icon.png`: 1024px desktop, tray, and package icon from the same mark.
- `app-icon.ico`: multi-size Windows executable, Task Manager, shortcut, and installer icon.
- `icons/`: generated 16, 32, 64, 128, 256, 512, and 1024px PNG sizes for Linux packaging and favicons.
- `app-icon.svg`: SVG wrapper for web-compatible icon references; Electron package targets use the PNG/ICO assets above.
- Older waveform / chrome-mic / speed variants may remain on disk for historical compatibility; do not use them for new UI.

## Rules

- Do not use Discord logos, icons, copied assets, or exact colors.
- Use `picom-logo-mark-v1.webp` (via `brandLogoUrl`) for in-app UI surfaces.
- Use `app-icon.png` / `app-icon.ico` for desktop window, package, Task Manager, tray, shortcut, and installer targets.
- Use `icons/32x32.png` (and `public/favicon.ico`) for browser favicons.
- Keep app icon branding original to Picom.
- Keep UI glyphs separate from brand icons. UI glyphs should use Coolicons through `AppIcon`.
- Regenerate icon derivatives with `python scripts/apply-picom-mark-icon.py [source.png]` (also refreshes `public/favicon.ico` and web PWA copies under `public/assets/brand/icons/`).
- Regenerate Windows installer bitmaps with `npm run installer:windows:art` after logo changes.
