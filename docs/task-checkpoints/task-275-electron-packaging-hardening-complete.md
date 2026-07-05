# Task 275 - Electron Packaging Hardening Complete

## Scope

Task 275 completes the repeated Electron packaging hardening block for Picom's Windows, Linux, and macOS desktop app.

## Completed hardening checks

- `npm run package:verify` exists as a lightweight local verification command.
- Package identity is verified:
  - `picom`
  - `Picom`
  - `com.picom.desktop`
- Window sizing is verified:
  - default `1440x900`
  - minimum `1100x700`
- Electron security posture is verified:
  - frameless custom chrome
  - hidden native menu
  - disabled native app menu
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: true`
  - `webSecurity: true`
  - insecure content disabled
  - packaged DevTools disabled
  - frozen preload bridge
  - external navigation guarded
  - webview attachment blocked
- Packaging targets are verified:
  - Windows NSIS x64
  - Linux AppImage x64
  - Linux deb x64
  - macOS dmg x64 placeholder
  - macOS zip x64 placeholder
- Package metadata is verified:
  - output directory
  - build resources directory
  - artifact naming
  - Linux package metadata
  - macOS usage descriptions
  - no active signing/notarization secret fields
  - no Discord branding in package/app metadata
- Required icon assets and platform smoke-test documents are verified.
- Build/package output directories are verified as ignored by Git.

## Verification commands

```bash
npm run package:verify
npm run typecheck
npm run build
```

## Remaining known issue

Local Windows unpacked packaging can still hit a workstation-specific `EPERM` rename error in `release/win-unpacked.tmp`. The config/build path is valid; the workaround is documented in `docs/electron-packaging.md`.
