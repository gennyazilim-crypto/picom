# Picom

Picom is a premium Electron desktop community chat app for Windows, Linux, and macOS.

The product direction is a desktop-first community chat experience with a custom Electron shell, Picom branding, Coolicons, Supabase backend foundations, and LiveKit/WebRTC voice and screen sharing foundations.

## Scope lock

Picom is desktop-only for this MVP track.

- Runtime: Electron.
- Platforms: Windows, Linux, macOS.
- Frontend: React, TypeScript, Vite.
- Backend foundation: Supabase Auth, Postgres, RLS, Storage, Realtime, and Edge Functions.
- Media foundation: LiveKit/WebRTC for voice rooms and screen sharing.
- UI direction: premium 4-column desktop chat layout with rounded surfaces and clean light/dark modes.

Do not add mobile UI, mobile navigation, web-first responsive layouts, Discord branding, Discord logos, copied Discord assets, copied Discord icons, or exact Discord colors.

## Active task source

The active task pack is:

```text
C:\Users\ACER\Desktop\electron_supabase_livekit_all_old_new_tasks_001_473_txt.zip
```

Older task packs are archive material only. New implementation work should follow the 001-473 Electron + Supabase + LiveKit sequence, one task at a time.

## Brand inputs

- App name: Picom
- Logo concept: `assets/brand/picom-logo-concept.png`
- Palette: `#007571`, `#10C2BB`, `#C24D0F`, `#FF772E`, `#752C05`
- Icon system: Coolicons Free icon set through `AppIcon`
- Coolicons attribution: `THIRD_PARTY_NOTICES.md`

## Install

```bash
npm install
```

## Run locally

Start the Electron desktop app:

```bash
npm run dev
```

Renderer-only development is available when needed:

```bash
npm run renderer:dev
```

Recommended desktop viewport for manual visual QA:

```text
1440x900
```

Minimum supported desktop width:

```text
1100px
```

## Environment

Use `.env.example` for local mock-mode development.

```bash
copy .env.example .env.local
```

Default local mode:

```text
VITE_DATA_SOURCE=mock
```

Use `.env.beta.example` for beta smoke testing against Supabase and LiveKit placeholders. Only renderer-safe `VITE_` values belong in Vite env files. Never commit Supabase service-role keys, LiveKit API secrets, signing keys, auth tokens, passwords, cookies, or database credentials.

Useful docs:

- `docs/beta-environment.md`
- `docs/environment-qa-gate.md`

## Quality gates

Run the main local quality gate after scoped changes:

```bash
npm run quality:fast
npm run quality:gate
```

The fast gate is intended for small code/doc checkpoints:

```bash
npm run qa:smoke
npm run typecheck
```

The full gate includes the production renderer/Electron build:

```bash
npm run build
```

Run Supabase-specific checks before Supabase-mode work:

```bash
npm run qa:supabase
```

The `qa:smoke` command currently runs:

- `npm run env:smoke`
- `npm run qa:output:smoke`
- `npm run react:hooks:smoke`
- `npm run logs:smoke`
- `npm run diagnostics:smoke`
- `npm run errors:smoke`
- `npm run crash:smoke`
- `npm run secrets:smoke`
- `npm run renderer:native:smoke`
- `npm run branding:smoke`
- `npm run desktop:smoke`
- `npm run electron:security:smoke`
- `npm run packaging:smoke`
- `npm run settings:diagnostics:smoke`
- `npm run livekit:smoke`
- `npm run mock:smoke`

Useful QA docs:

- `docs/qa-smoke-gate.md`
- `docs/diagnostics-logging-qa.md`
- `docs/error-handling-qa.md`
- `docs/logging-qa-gate.md`
- `docs/environment-qa-gate.md`
- `docs/packaging-qa-gate.md`
- `docs/react-hook-order-qa.md`
- `docs/design-reference-qa.md`

## Supabase

Supabase is the MVP backend foundation for:

- Auth
- Postgres
- RLS
- Storage
- Realtime
- Edge Functions

Run the Supabase smoke gate:

```bash
npm run qa:supabase
```

This gate checks schema/API-mode readiness without production secrets. A missing local Supabase CLI may produce a setup warning for reset workflows, but it should not block renderer mock-mode development.

## Development tools

Run a safe in-memory realtime load simulation:

```bash
npm run realtime:load:simulate
```

Useful custom run:

```bash
npm run realtime:load:simulate -- --clients=10 --messages=5 --delayMs=25 --channelId=general
```

The simulation is development-only, defaults to dry-run mode, does not connect to Supabase, and must not be used as a production load test. See `docs/realtime-load-simulation.md`.

## LiveKit

LiveKit/WebRTC is the MVP foundation for:

- Voice room join/leave
- Mute/deafen state
- Speaking state
- Screen share track foundations
- Supabase Edge Function token flow

Run the LiveKit smoke gate:

```bash
npm run livekit:smoke
```

See `docs/livekit-qa-gate.md` for the current checks.

## Packaging

Picom uses `electron-builder` for desktop package preparation.

Verify package configuration without creating installers:

```bash
npm run packaging:smoke
npm run package:verify
```

Build package artifacts:

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

Packaging notes:

- Output directory: `release/`
- Windows target: unsigned NSIS x64
- Linux targets: AppImage x64 and deb x64
- macOS targets: unsigned dmg x64 and zip x64 placeholders
- Signing and notarization are intentionally not configured yet
- Do not commit certificates, private keys, signing keys, or notarization credentials

Useful docs:

- `docs/packaging-hardening.md`
- `docs/electron-packaging.md`
- `docs/windows-smoke-test.md`
- `docs/linux-smoke-test.md`
- `docs/macos-smoke-test.md`

## Manual UI smoke test

1. Run `npm run dev`.
2. Confirm the Electron window opens.
3. Confirm there is no native File/Edit/View menu.
4. Confirm the custom titlebar is visible.
5. Test minimize, maximize/restore, and close.
6. Confirm the 4-column desktop layout renders.
7. Toggle light/dark mode.
8. Switch communities and channels.
9. Send a local mock message.
10. Search members.
11. Open Settings, context menu, profile popover, and image preview.
12. Resize below 1100px and confirm the desktop-only warning appears.

## Workflow

1. Follow one task file at a time from the active 001-473 pack.
2. Keep changes scoped to the task.
3. Run the smallest relevant checks.
4. Run `npm run qa:smoke`, `npm run typecheck`, and `npm run build` for checkpoints.
5. Commit stable task checkpoints.
6. If build/typecheck breaks, stop feature work and fix the blocker first.
