# Picom

Picom is a fresh premium desktop community chat app rebuild.

## Active task source

The active task pack is now:

- `C:\Users\ACER\Desktop\electron_supabase_livekit_all_old_new_tasks_001_473_txt.zip`

The older 260-task packs and earlier 001-186 pack remain historical archive material only. New implementation work should follow the 001-473 Electron + Supabase + LiveKit task sequence.

## Current MVP direction

- Runtime: Electron desktop app.
- Platforms: Windows, Linux, macOS.
- Frontend: React + TypeScript + Vite.
- Backend foundation: Supabase Auth, Postgres, RLS, Storage, Realtime, Edge Functions.
- Media foundation: LiveKit/WebRTC for voice and screen sharing.
- UI target: premium 4-column desktop community chat structure.
- Icon system: Coolicons Free icon set, attributed in `THIRD_PARTY_NOTICES.md`.

## Brand inputs

- App name: Picom
- Logo concept: `assets/brand/picom-logo-concept.png`
- Palette: `#007571`, `#10C2BB`, `#C24D0F`, `#FF772E`, `#752C05`
- UI references: provided desktop chat reference image, Orion preview assets, Material X reference where accessible.

## Hard exclusions

- No iOS or Android in this Electron MVP.
- No Discord branding, logos, copied assets, icons, or exact colors.
- No enterprise/plugin/bot marketplace work before the MVP is stable.

## Development

```bash
npm install
npm run dev
```

Open the local Vite URL and use a desktop viewport such as `1440x900`.

## Packaging

Picom uses `electron-builder` for Windows, Linux, and macOS package preparation.

```bash
npm run package:verify
npm run build
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

- `npm run package:verify` checks package identity, platform targets, window sizing, Electron security posture, and required icon paths without building installers.
- `npm run package` creates an unpacked local build in `release/`.
- `npm run package:win:dir` creates an unpacked Windows x64 smoke build.
- `npm run package:linux:appimage` creates a Linux AppImage target on a Linux host/CI runner.
- `npm run package:linux:deb` creates a Debian/Ubuntu `.deb` package on a Linux host/CI runner.
- `npm run package:mac:dmg` and `npm run package:mac:zip` create macOS artifacts on a macOS host/CI runner.
- Windows builds target an unsigned NSIS x64 installer.
- Linux builds target AppImage x64 and deb x64.
- macOS builds target an unsigned dmg x64 placeholder.
- Signing/notarization is intentionally not configured yet; do not commit certificates, private keys, or signing secrets.

See `docs/packaging-hardening.md` and `docs/electron-packaging.md` for packaging notes, hardening checks, and platform implications.
Use the platform smoke-test checklists in `docs/windows-smoke-test.md`, `docs/linux-smoke-test.md`, and `docs/macos-smoke-test.md` after a package build.

## Workflow

1. Follow one task file at a time from the active 001-473 pack.
2. Test after each task.
3. Commit stable checkpoints to Git.
4. If build/typecheck breaks, stop feature work and fix the blocker first.
