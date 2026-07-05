# Electron Packaging

Task 247 configures `electron-builder` for Picom desktop packaging.

See `docs/app-identity.md` for the canonical Picom app name and identifier values.

## Packaging tool decision

Picom uses `electron-builder` because the project already has:

- Vite renderer output in `dist/`
- Electron main/preload output in `dist-electron/`
- a root `main` entry pointing to `dist-electron/main.cjs`

This avoids a larger Electron Forge migration while giving straightforward Windows, Linux, and macOS targets.

## Commands

```bash
npm run package
npm run package:win:dir
npm run package:win
npm run package:linux:appimage
npm run package:linux:deb
npm run package:linux
npm run package:mac:dmg
npm run package:mac:zip
npm run package:mac
```

`npm run package` creates an unpacked directory build for local smoke checks.
`npm run package:win:dir` creates an unpacked Windows x64 smoke build.
`npm run package:linux:appimage` creates a Linux AppImage target on a Linux host or CI runner.
`npm run package:linux:deb` creates a Debian/Ubuntu package on a Linux host or CI runner.
`npm run package:mac:dmg` and `npm run package:mac:zip` create macOS artifacts on a macOS host or CI runner.

## Targets

- Windows: NSIS x64 installer.
- Linux: AppImage x64 and deb x64.
- macOS: dmg x64 placeholder target.

## Output

Artifacts are written to:

```text
release/
```

## Branding assets

The packaging config references:

```text
assets/brand/app-icon.png
assets/brand/app-icon.svg
assets/brand/app-icon.ico
assets/brand/icons/
```

Before final release, generate platform-native icon formats if needed:

- Windows final multi-size `.ico`
- macOS `.icns`
- Linux icon size set

## Signing and notarization

- Local builds are unsigned.
- Windows code signing is not configured yet.
- macOS signing/notarization is not configured yet.
- No certificates, private keys, signing passwords, or production credentials are committed.

## Manual verification

1. Run `npm run build`.
2. Run `npm run package` for an unpacked local smoke build.
3. On Windows, run `npm run package:win:dir` before the installer build.
4. On Windows, run `npm run package:win` when NSIS packaging is available.
5. On Linux, run `npm run package:linux` on a Linux runner or VM.
6. On macOS, run `npm run package:mac` on macOS.
7. Confirm the packaged app opens, shows the custom Picom titlebar, and keeps the 4-column desktop layout.

Platform smoke-test checklists:

- `docs/windows-smoke-test.md`
- `docs/linux-smoke-test.md`
- `docs/macos-smoke-test.md`

## Known local Windows packaging issue

On the current Windows workstation, `npm run package` successfully runs the renderer/Electron build and loads `electron-builder.yml`, but the unpacked smoke package can fail at Electron's temporary folder rename step:

```text
EPERM: operation not permitted, rename 'release\\win-unpacked.tmp' -> 'release\\win-unpacked'
```

If this appears:

1. Close any running Picom/Electron process.
2. Delete the generated `release/win-unpacked.tmp` folder.
3. Retry from a normal local folder or an elevated terminal if Windows Controlled Folder Access or antivirus is locking Desktop writes.
4. Treat this as a local filesystem smoke-test blocker, not a TypeScript/Vite build failure.
