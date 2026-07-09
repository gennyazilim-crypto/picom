# Download, Install, Uninstall, and Roll Back Picom

## Current availability

No stable Picom download is currently authorized. Do not treat private beta artifacts as stable. When stable is approved, use only the official release location published by the Picom team.

## Before installation

1. Confirm platform/architecture and exact version.
2. Compare the artifact SHA-256 with the published checksum.
3. Verify Windows publisher or macOS signature/notarization for stable artifacts.
4. Close running Picom windows/processes before upgrade.
5. Do not disable antivirus, SmartScreen, Gatekeeper, or system privacy globally.

## Windows x64

### Install/upgrade

1. Download `Picom-<version>-Windows-x64.exe`.
2. Verify SHA-256 and Authenticode publisher/status.
3. Run the installer as the current user; administrator elevation is not normally required.
4. Choose install directory if offered and launch through Desktop/Start Menu.
5. For upgrade, install the newer approved version over the previous install, then confirm About/Diagnostics version.

### Uninstall

Quit Picom fully, including tray/background state, then use Windows **Installed apps**. Verify shortcuts/binaries are removed. Normal uninstall must not delete unrelated user files. Local Picom data/cache behavior follows the release’s deletion policy.

### Manual rollback

Quit/uninstall the affected version, verify the previous approved installer/hash/backend compatibility, reinstall it, and confirm session/settings/core chat. Do not delete local data unless support explicitly explains why and what will be lost.

## Linux x64 AppImage

### Run

```bash
chmod +x Picom-<version>-Linux-x86_64.AppImage
./Picom-<version>-Linux-x86_64.AppImage
```

Verify checksum before making executable. Desktop integration depends on the distro/user’s tooling.

### Remove/rollback

Quit Picom and remove only the verified AppImage plus explicit user-created integration entry. Run the previous approved AppImage after checksum verification. Never recursively delete a guessed user directory.

## Linux x64 deb

### Install/upgrade

```bash
sudo apt install ./Picom-<version>-Linux-x86_64.deb
```

Launch from terminal or desktop menu. Exact generated filename/package ID must match the published release record.

### Uninstall/rollback

Use `dpkg -l | grep -i picom` to verify the installed package name, then remove it with the distro package manager. Install the prior approved deb to roll back. Record retained local data/cache; do not remove unrelated files.

## macOS x64

### dmg

1. Download `Picom-<version>-macOS-x64.dmg` and verify SHA-256/notarization/signature.
2. Mount and copy Picom to Applications.
3. Launch from Finder with Gatekeeper enabled.

### zip

Verify SHA-256/signature/notarization, extract, and move Picom to Applications according to the release instructions.

### Uninstall/rollback

Quit Picom and move the app from Applications to Trash. Do not remove user data unless explicitly requested. Install the previous approved signed/notarized artifact to roll back. Microphone/Screen Recording settings may remain under System Settings and should be changed only by the user.

## First launch and verification

- Confirm custom Picom titlebar, no duplicate native menu, and correct light/dark appearance.
- Confirm version/channel in Settings diagnostics.
- Sign in or use the documented mock/private beta path.
- Verify communities/channels/message send and no startup error.
- Grant microphone/screen permission only when intentionally using voice/share.

## Getting support

Use the approved release support/feedback channel listed with the artifact. Include version, platform/architecture, artifact hash, reproduction steps, expected/actual result, and optional redacted diagnostics. Never send passwords, access/session tokens, `.env` files, provider secrets, private keys, or unnecessary private content.

If a release is declared bad, follow the official status/rollback notice rather than downloading an unverified replacement.
