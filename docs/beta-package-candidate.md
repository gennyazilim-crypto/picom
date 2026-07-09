# Picom Beta Package Candidate

## Candidate status

Picom `0.1.0` is source-, configuration-, and Windows-package-ready for an unsigned local beta candidate. TypeScript, mock-mode smoke, renderer/Electron production build, packaging configuration verification, and Windows NSIS packaging pass on Windows.

The initial 2026-07-09 package attempt was blocked by stale Picom Vite/Electron processes holding the electron-builder output. After those project-specific processes and incomplete `.tmp` directories were closed/cleared, the standard `npm run package:win` command completed successfully.

Windows candidate:

- Installer: `release/Picom-0.1.0-Windows-x64.exe`
- Installer size: `120817642` bytes
- SHA-256: `208BB16DE5A32D097017E727E83C36134C4DD22B7EBF5880004063862C44ADB3`
- Block map: `release/Picom-0.1.0-Windows-x64.exe.blockmap`
- Unpacked executable: `release/win-unpacked/Picom.exe`

## Verified metadata and security

| Item | Verified value |
| --- | --- |
| Package name/version | `picom` / `0.1.0` |
| Product name | `Picom` |
| Application ID | `com.picom.desktop` |
| Main entry | `dist-electron/main.cjs` |
| Packaged preload | `dist-electron/preload.cjs` via `path.join(__dirname, "preload.cjs")` |
| Renderer output | `dist/**` |
| Packaged renderer asset base | relative `./` paths for `file://` loading |
| Context isolation | enabled |
| Node integration | disabled |
| Renderer sandbox | enabled |
| ASAR | enabled |
| Protocol | `picom://` |
| Native menu | disabled by Electron main process |

The configured brand assets exist:

- `assets/brand/app-icon.ico`
- `assets/brand/app-icon.png`
- `assets/brand/app-icon.svg`
- `assets/brand/icons/`

## Package targets and commands

Run all commands from the repository root.

Common desktop build:

```powershell
npm run build:desktop
```

### Windows x64

```powershell
npm run package:win
# Equivalent release alias:
npm run package:windows
```

Expected output:

- `release/Picom-0.1.0-Windows-x64.exe`
- `release/win-unpacked/`

If `EPERM` occurs during the `win-unpacked.tmp` rename:

1. Close every running Picom/Electron process and File Explorer window showing the output directory.
2. Confirm Windows Security Controlled Folder Access or antivirus is not quarantining electron-builder operations.
3. Remove only the incomplete `.tmp` output after confirming no Picom process is using it.
4. Run `npm run package:win` again from a normal PowerShell terminal.

The local beta may remain unsigned. Windows SmartScreen warnings are expected until code signing is configured; certificates and passwords must never be committed.

### Linux x64

Run on a Linux build host:

```bash
npm ci
npm run package:linux:appimage
npm run package:linux:deb
```

Expected outputs are `Picom-0.1.0-Linux-x86_64.AppImage` and a Debian package in `release/`. Linux artifacts are not claimed from the Windows run.

### macOS x64

Run on a macOS build host:

```bash
npm ci
npm run package:mac:dmg
npm run package:mac:zip
```

Expected outputs are `Picom-0.1.0-macOS-x64.dmg` and `.zip` in `release/`. macOS packaging, signing, notarization, microphone permission, and screen-recording permission checks require macOS hardware or a macOS CI runner.

## Beta environment

- Package creation does not embed production secrets.
- Configure staging values through the documented local/CI environment for Supabase and LiveKit.
- Never commit a populated `.env` file, Supabase service-role key, LiveKit secret, signing certificate, or certificate password.
- Run `npm run env:smoke` and the staging smoke check before distributing a candidate built with staging connectivity.

## Candidate gate

Before distribution:

1. `npm ci`
2. `npm run typecheck`
3. `npm run mock:smoke`
4. `npm run build`
5. `npm run package:verify`
6. Run the package command on the target operating system.
7. Install and launch the artifact on a clean test account.
8. Verify the custom titlebar, preload bridge, login/session startup, mock mode, and staging mode.
9. Generate checksums and provenance only after final artifacts exist.

## Current gaps

- Windows installer creation now passes; clean-account install, launch, uninstall, protocol, and staging-connectivity smoke tests remain required.
- Linux AppImage/deb must be generated and smoke-tested on Linux.
- macOS dmg/zip must be generated and smoke-tested on macOS.
- Signing/notarization is intentionally not required for this local beta candidate and remains a release-readiness item.
- Vite reports non-blocking chunks over 500 kB; bundle splitting is a later optimization and does not block this packaging gate.
