# Picom Installer Branding

Picom's setup experience uses original desktop-focused artwork and the existing product identity. It must not include Discord branding, copied assets, or unlicensed imagery.

## Direction

- Picom name and original P-ribbon mark.
- Teal/mint accent with cool gray surfaces and restrained blue depth.
- Clear Windows/Linux/macOS desktop language.
- Light/dark in-app setup using existing design tokens and Coolicons/AppIcon.

## Asset structure

- `assets/installer/shared`: cross-platform source mark and wordmark placeholders.
- `assets/installer/windows`: NSIS wizard assets and notes.
- `assets/installer/macos`: DMG background and notes.
- `assets/installer/linux`: package/desktop metadata notes.

Files ending in `.placeholder.*` are not final release artwork. Packaging must reference final raster/vector variants only after visual and legal review.

## Platform hooks

- Windows: electron-builder NSIS assisted installer, Picom icons, desktop/Start Menu shortcuts, optional launch after install, and future branded header/sidebar bitmaps.
- macOS: DMG background, Picom app icon, Applications shortcut, and separate signing/notarization workflow.
- Linux: Picom icon set, Network/Chat/Utility metadata, AppImage/deb targets, and native desktop-entry validation.

## First launch

`FirstLaunchSetup` runs before login/register on a fresh local settings profile. It covers welcome, theme, permission explanation, voice/screen sharing, and completion. It never requests microphone, notification, or screen-capture access. Completion is stored in the versioned local settings service and account onboarding remains a separate authenticated flow.
