# Linux AppImage Packaging

Task 249 configures Linux AppImage packaging for Picom.

## Target

- Builder: `electron-builder`
- Platform: Linux x64
- Primary target: AppImage
- Additional Linux target in general config: deb
- App category: `Network`
- Product name: `Picom`
- Executable name: `Picom`

## Commands

```bash
npm run package:linux:appimage
npm run package:linux
```

Use `npm run package:linux:appimage` when the goal is only the AppImage smoke artifact.

## Expected output

Artifacts are written to:

```text
release/
```

Expected AppImage naming:

```text
Picom-<version>-Linux-x64.AppImage
```

## Linux host recommendation

Linux packaging should be run on a Linux machine, VM, or CI runner. Cross-building Linux AppImage from Windows may require extra host tooling and is not the primary local smoke path.

## Runtime expectations

The AppImage build should preserve:

- custom Picom titlebar
- no native File/Edit/View menu
- default window size 1440 x 900
- minimum window size 1100 x 700
- fixed 4-column desktop layout
- tray/notification/file/clipboard services with safe fallbacks if unavailable

## Icon

Linux packaging currently uses:

```text
assets/brand/icons/
```

Before final release, prepare a proper Linux icon size set if the desktop environment requires it.

## Manual verification

1. Run `npm run build`.
2. On Linux, run `npm run package:linux:appimage`.
3. Mark the AppImage executable if needed: `chmod +x Picom-*.AppImage`.
4. Launch the AppImage.
5. Confirm the custom titlebar, 4-column layout, theme toggle, message composer, member sidebar, and native-service fallbacks work.
