# Picom Installer Branding

Picom's setup experience uses original desktop-focused artwork and the existing product identity. It must not include Discord branding, copied assets, or unlicensed imagery.

## Direction

- Direction: light installer only — soft gray/white panels, crimson accent, chrome mic + glowing P mark (`picom-logo-mic-chrome-v1`).
- Clear Windows/Linux/macOS desktop language.
- Light/dark in-app setup using existing design tokens and Coolicons/AppIcon.

## Asset structure

- `assets/installer/shared`: cross-platform source mark and wordmark placeholders.
- `assets/installer/windows`: final NSIS header/sidebar bitmaps and notes.
- `assets/installer/macos`: final current DMG background and notes.
- `assets/installer/linux`: package/desktop metadata notes.

Files ending in `.placeholder.*` are not final release artwork. Packaging must reference final raster/vector variants only after visual and legal review.

The current package configuration references only reviewed Picom raster/icon
assets. Placeholder SVGs are source-direction aids and are intentionally absent
from `electron-builder.yml`. See `docs/installer-assets.md` for dimensions,
ownership, replacement rules, and the release inventory.

## Platform hooks

- Windows: electron-builder NSIS assisted installer, Picom icons, desktop/Start Menu shortcuts, optional launch after install, branded **sidebar** bitmap only (no top header strip), English (`en_US`) + Turkish (`tr_TR`) with an installer language selector, license acceptance (`nsis.license` → picom.gg terms/security), and an informational finish-page link to https://picom.gg. Public URLs: see [`docs/installer/legal-links.md`](installer/legal-links.md).
- macOS: DMG background, Picom app icon, Applications shortcut, and separate signing/notarization workflow.
- Linux: Picom icon set, Network/Chat/Utility metadata, AppImage/deb targets, and native desktop-entry validation.

Bilingual copy review lives in [`docs/installer/bilingual-copy.md`](installer/bilingual-copy.md). Live preview: [`docs/installer/live-preview.html`](installer/live-preview.html). Regenerate Windows BMPs with `npm run installer:windows:art` when the approved app icon changes.

## First launch

`FirstLaunchSetup` runs before login/register on a fresh local settings profile. It covers welcome, theme, permission explanation, voice/screen sharing, and completion. It never requests microphone, notification, or screen-capture access. Completion is stored in the versioned local settings service and account onboarding remains a separate authenticated flow.
