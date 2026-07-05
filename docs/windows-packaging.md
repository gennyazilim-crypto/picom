# Windows Packaging

Task 248 configures Windows packaging for Picom.

## Target

- Builder: `electron-builder`
- Platform: Windows x64
- Installer: NSIS
- Local smoke output: unpacked Windows directory
- App ID: `com.picom.desktop`
- Product name: `Picom`
- Executable name: `Picom`

## Commands

```bash
npm run package:win:dir
npm run package:win
```

Use `npm run package:win:dir` first for a local unpacked smoke test. Use `npm run package:win` for the unsigned NSIS installer.

## Window expectations

The packaged Windows app should keep:

- custom Picom titlebar
- no native File/Edit/View menu
- default window size 1440 x 900
- minimum window size 1100 x 700
- frameless desktop shell
- fixed 4-column layout

## Icon

Windows packaging uses:

```text
assets/brand/app-icon.ico
```

This `.ico` file is generated from the Picom placeholder logo and is safe for MVP smoke builds. Replace with final multi-size production icon assets before release.

## Signing

Local Windows builds are unsigned.

Production signing placeholders are documented in `electron-builder.yml` using environment variables:

- `WINDOWS_CERTIFICATE_FILE`
- `WINDOWS_CERTIFICATE_PASSWORD`

Do not commit certificate files, private keys, passwords, or signing secrets.

## Known local issue

On the current Windows workstation, unpacked packaging can fail during Electron's temporary folder rename step:

```text
EPERM: operation not permitted, rename 'release\\win-unpacked.tmp' -> 'release\\win-unpacked'
```

If this appears, close running Electron/Picom processes, delete `release/win-unpacked.tmp`, and retry from a terminal/location not blocked by Windows Controlled Folder Access or antivirus.
