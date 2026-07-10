# Linux Stable Build Candidate

Status date: 2026-07-10  
Candidate status: **Blocked pending a supported Linux build/test host**

## Configuration status

- Electron packaging configuration verification: Passed.
- Linux distribution policy/metadata smoke: Passed.
- Configured targets: AppImage x64 and deb x64.
- rpm is intentionally not enabled because it has not been verified.
- Product/executable: Picom.
- Category: Network.
- Icon source: `assets/brand/icons`.
- Maintainer and desktop metadata are present.

## Windows-hosted build attempt

An AppImage build was attempted using a unique temp output. Electron's Linux payload unpacked and the AppImage stage began, then Windows rejected the required Linux icon symlink with `EPERM`:

`usr/share/icons/hicolor/1024x1024/apps/Picom.png -> .../__appImage-x64/Picom.png`

This is a host capability failure, not a TypeScript or renderer build failure. No Linux artifact is claimed.

## Required native Linux execution

Run on an approved Linux x64 runner/host:

```bash
npm ci
npm run typecheck
npm run mock:smoke
npm run build
npm run package:linux:appimage
npm run package:linux:deb
```

Then verify:

1. AppImage executable bit, launch, custom titlebar, and no unwanted native menu.
2. deb install, desktop entry/icon, launch, upgrade/reinstall, and uninstall.
3. Login/register/session restore, onboarding, Mention Feed/profile, community/channel/message, upload, DM, settings/theme, and diagnostics.
4. Microphone and screen-sharing behavior under the supported desktop session.
5. Wayland/PipeWire portal and X11 notes where applicable.
6. Checksum/provenance and dependency documentation.

RB-07 remains open. A Windows cross-build attempt cannot certify Linux behavior.

## Task 400 closure attempt

Linux packaging metadata, repository distribution, safe install, signing lifecycle, and rollback contracts passed on 2026-07-10. No native Linux runner or artifact was available, so AppImage/deb execution and checksums remain blocked. See `docs/linux-native-package-validation.md`.

## Task 409 real execution

Native Linux package and screen-share certification remained **BLOCKED**. No Linux runner, AppImage/deb artifact, desktop session, portal stack, remote client, or final checksum was available. See `docs/linux-native-package-screen-share-certification.md`.
