# Linux deb Packaging

Task 250 configures Debian/Ubuntu `.deb` packaging for Picom.

## Target

- Builder: `electron-builder`
- Platform: Linux x64
- Package target: deb
- Debian category: `net`
- Priority: `optional`
- Product name: `Picom`
- Executable name: `Picom`

## Command

```bash
npm run package:linux:deb
```

`npm run package:linux` also includes the deb target alongside AppImage.

## Expected output

Artifacts are written to:

```text
release/
```

Expected deb naming:

```text
Picom-<version>-Linux-x64.deb
```

## Linux host recommendation

Build and install-test `.deb` packages on Debian/Ubuntu or a compatible Linux CI runner. Windows is not the reliable smoke-test host for Linux package installation.

## Manual verification

1. Run `npm run build`.
2. On Linux, run `npm run package:linux:deb`.
3. Install locally with `sudo apt install ./Picom-*.deb` or `sudo dpkg -i Picom-*.deb`.
4. Launch Picom from the app menu or terminal.
5. Confirm the custom titlebar, 4-column layout, theme toggle, message composer, and native-service fallbacks work.
6. Uninstall with `sudo apt remove picom` and confirm desktop entries are removed.

## Signing

Package signing is not configured for the MVP. Do not commit signing keys or repository credentials.
