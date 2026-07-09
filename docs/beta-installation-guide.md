# Picom Beta Installation Guide

Use only a versioned artifact supplied through the approved Picom beta channel. Verify the SHA-256 checksum before installation.

## Windows

1. Quit any running Picom development/installed process.
2. Verify `Picom-<version>-Windows-x64.exe` against the supplied checksum.
3. Run the installer as the current user; administrator elevation should not normally be required.
4. An unsigned internal beta can show SmartScreen publisher warnings. Stop if the source or checksum is uncertain.
5. Launch Picom and verify the custom titlebar appears without the native File/Edit/View menu.
6. Test login/register, onboarding, Mention Feed, community chat, close/reopen, and theme persistence.

Uninstall from Windows Settings > Apps > Installed apps > Picom. Record whether local beta settings remain before a clean-reinstall test.

## Linux AppImage

```bash
chmod +x Picom-<version>-Linux-x86_64.AppImage
./Picom-<version>-Linux-x86_64.AppImage
```

For deb:

```bash
sudo apt install ./Picom-<version>-Linux-amd64.deb
```

Record distro, desktop environment, X11/Wayland, PipeWire, and portal details. Remove the AppImage for portable uninstall or use the package manager for deb removal.

## macOS

1. Verify the dmg/zip checksum.
2. Install/move Picom into Applications.
3. An unsigned internal beta can trigger Gatekeeper. Follow only the beta coordinator's approved internal procedure; do not disable macOS security globally.
4. Grant microphone and Screen Recording permissions only when testing those features.
5. Restart Picom when macOS requires it after screen-recording approval.

Quit Picom and move it from Applications to Trash to uninstall. Remove local test data only when the smoke test explicitly requires a clean reinstall.

## Updating

Production auto-update is not included. Quit Picom, verify the new artifact checksum, install the new version, then repeat startup/session/chat smoke tests. Read release notes for local-data compatibility before removing settings/cache.

## Troubleshooting

- White window: confirm the artifact includes the relative Vite asset-path fix and matches the approved checksum.
- Windows `EPERM` during local packaging: close project-specific Vite/Electron processes and clear only incomplete `.tmp` output.
- Voice/screen share unavailable: confirm staging is configured and OS permissions are granted; never place LiveKit secrets in the renderer.
- Supabase unavailable: confirm the approved public staging configuration without sharing tokens or privileged keys.

