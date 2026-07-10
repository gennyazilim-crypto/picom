# macOS DMG Customization

Picom's electron-builder DMG uses original artwork at `assets/installer/macos/dmg-background.png`.

## Layout

- Picom app icon: x 176, y 224.
- Applications shortcut: x 484, y 224.
- Icon size: 104.
- Instruction: Drag Picom to Applications.
- DMG title: `Picom ${version}`.

## Permissions

- Microphone access is requested only when the user enters voice and performs a microphone action.
- Screen recording/screen sharing is requested only after explicit share/source selection.
- macOS users may need to enable Screen Recording in System Settings and restart Picom.
- Setup/DMG mounting must never trigger either permission.

## Signing and notarization

The local base configuration supports unsigned development packages. Production uses `electron-builder.macos-release.yml` with hardened runtime, reviewed entitlements, signing, notarization, stapling, and Gatekeeper verification in protected macOS CI. No Apple credential belongs in the repository.

## Build and manual test

On macOS:

```bash
npm ci
npm run package:mac:signed-candidate
```

Verify DMG artwork, icon positions, drag to Applications, launch, quarantine/Gatekeeper, microphone denial/retry, screen-recording denial/recovery, reinstall, remove, checksum, and provenance. This Windows host cannot produce or certify the DMG.
