# Picom App Icon Assets

These are the approved Picom desktop application icon assets for Electron packaging.

## Files

- `picom-logo-waveform-v3.png`: latest transparent red P + microphone + waveform logo (owner-provided, July 2026).
- `picom-logo-waveform-v2.png`: current UI wordmark (transparent red P + microphone + waveform) used across login, title bar, and global sidebar.
- `picom-logo-v2.png`: previous black-background logo variant retained for reference.
- `picom-logo-concept.png`: previous logo concept retained for reference.
- `app-icon.png`: 1024px package/tray icon generated from the owner-provided `desktop_icon_v2.png`.
- `app-icon.ico`: multi-size Windows package/installer icon generated from the same approved source.
- `icons/`: generated 16, 32, 64, 128, 256, 512, and 1024px PNG sizes for Linux packaging.
- `app-icon.svg`: legacy vector reference; Electron package targets use the approved PNG/ICO assets above.

## Rules

- Do not use Discord logos, icons, copied assets, or exact colors.
- Treat `desktop_icon_v2.png` derivatives as the desktop icon source until the project owner approves a replacement.
- Keep app icon branding original to Picom.
- Keep UI glyphs separate from brand icons. UI glyphs should use Coolicons through `AppIcon`.
