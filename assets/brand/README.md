# Picom App Icon Assets

These are the approved Picom desktop application icon assets for Electron packaging.

## Files

- `picom-logo.png`: approved 2026 Picom waveform/microphone master with a real transparent background.
- `picom-logo-mic-chrome-v1.png`: compatibility filename for the compact primary UI mark used by the title bar, auth, sidebar, and dashboard.
- `picom-logo-mic-chrome-v1.webp`: renderer-optimized derivative of the compact primary mark.
- `picom-logo-waveform-v2.png`: compatibility filename for the full approved waveform mark used by Discovery.
- `picom-logo-waveform-v2.webp`: renderer-optimized derivative of the full waveform mark.
- `app-icon.png`: 1024px transparent desktop, tray, and package icon cropped for legibility at small sizes.
- `app-icon.ico`: multi-size Windows executable, Task Manager, shortcut, and installer icon from the same source.
- `picom-logo-waveform-v3.png`: full approved waveform mark retained for compatibility.
- `picom-logo-v2.png`: earlier black-background variant (retained).
- `picom-logo-concept.png`: earlier concept (retained).
- `icons/`: generated 16, 32, 64, 128, 256, 512, and 1024px PNG sizes for Linux packaging (regenerate when packaging).
- `app-icon.svg`: SVG wrapper for web-compatible icon references; Electron package targets use the approved PNG/ICO assets above.

## Rules

- Do not use Discord logos, icons, copied assets, or exact colors.
- Use `picom-logo-mic-chrome-v1.png` for compact in-app UI surfaces (`picom-brand-logo`, auth, sidebar, title bar).
- Use `picom-logo-waveform-v2.png` for the wider Discovery/marketing treatment.
- Use `app-icon.png` / `app-icon.ico` for desktop window, package, Task Manager, tray, shortcut, and installer targets.
- Keep app icon branding original to Picom.
- Keep UI glyphs separate from brand icons. UI glyphs should use Coolicons through `AppIcon`.
- Regenerate Windows installer bitmaps with `npm run installer:windows:art` after logo changes.
