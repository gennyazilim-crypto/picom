# Full MVP Final Audit

Date: 2026-07-06
Product: Picom desktop community chat app
Platforms: Windows, Linux, macOS
Decision: Ready with non-blockers for beta QA. Not ready for production/live until the manual platform, Supabase CLI, and release hardening checks below are completed.

## 1. Full MVP readiness

Status: Ready with non-blockers.

Picom's current Full MVP codebase passes the local quality gate and the main structural smoke tests. The Electron shell, mock mode, Supabase schema foundation, LiveKit MVP wiring, screen-share bridge, and Windows package directory build are in a usable beta-QA state.

This audit does not claim production readiness. Linux and macOS package smoke must be run on those platforms, Supabase CLI-backed reset/RLS tests must be run after installing the CLI, and LiveKit/Supabase must be validated against real hosted credentials before beta expansion.

## 2. Completed areas

### Electron shell

- Custom titlebar is implemented.
- Native File/Edit/View menu is disabled through Electron configuration.
- Window default size is documented as 1440x900.
- Minimum size is documented as 1100x700.
- Frameless custom chrome is verified by packaging smoke.
- Safe preload bridge is verified by packaging smoke.
- contextIsolation is enabled.
- nodeIntegration is disabled.
- Windows unpacked package generation passed on this workstation.

### UI

- ServerRail, CommunitySidebar, ChatMain, MessageList, MessageComposer, and MemberSidebar are implemented.
- Mention Feed exists with story header, social footer, and companion rail.
- Full Profile Page exists.
- Settings, DesktopContextMenu, and ImagePreview surfaces exist.
- Light/dark mode and Picom design tokens are in place.
- Coolicons/AppIcon is the approved icon direction.
- No mobile UI was added in this audit.

### Messaging

- Mock/local message flow is covered by mock smoke.
- Local reactions and message-service paths are covered structurally.
- Attachments and image preview are represented in the UI foundation.
- Reply/reaction/emoji MVP paths exist in the renderer foundation.

### Community access

- Role-aware community access/menu work is present.
- Owner/admin/mod/member/visitor behavior is represented in the mock/service layer.
- Join/leave and visitor read-only states are prepared.
- Private channel hiding is covered by access helpers and smoke coverage.
- Composer permission-state foundation exists.

### Supabase

- Supabase migrations are present for profiles, communities, members, roles, categories, channels, messages, attachments, reactions, read states, indexes, storage, and RLS.
- Supabase client/service wrappers exist.
- Structural Supabase smoke passed.
- RLS SQL test files and smoke wrapper exist.
- Service-role key is documented as server-only and is not required in renderer env examples.

### LiveKit and screen share

- LiveKit dependency and renderer service are verified by smoke.
- Deterministic room naming is verified.
- Token Edge Function structure is verified.
- Voice room UI wiring is verified.
- Electron screen-share bridge is verified.
- Screen share controls and preview are verified.

### Cross-platform package

- Electron builder config is verified.
- Windows, Linux, and macOS smoke docs exist.
- Windows unpacked package generation passed on this workstation.
- Linux/macOS smoke plans are documented without falsely claiming local success.

## 3. Partial areas

- Supabase smoke is structural because Supabase CLI is not installed on this workstation.
- RLS tests are prepared, but full local reset/RLS execution requires Supabase CLI.
- Linux package smoke must be run on Linux.
- macOS package smoke must be run on macOS.
- LiveKit smoke verifies wiring, not a real hosted LiveKit session with multiple users.
- Screen share smoke verifies bridge and renderer wiring, not OS permission prompts on all platforms.
- Bundle size warning remains and should be addressed before production, but it does not block beta QA.

## 4. Critical blockers

No local code/build blockers were found in this final audit.

Production/live blockers remain:

- Supabase CLI-backed database reset/RLS tests have not been executed on this machine.
- Hosted Supabase auth/storage/realtime credentials still need a real environment validation pass.
- Hosted LiveKit voice/screen-share test with two clients still needs manual validation.
- Linux and macOS package launches still need platform smoke results.
- Signing, notarization, updater, and production release hardening are outside the current verified beta gate.

## 5. Non-blocking known issues

- Vite reports chunks larger than 500 kB after minification.
- voiceService is separately chunked but still large because LiveKit is a significant dependency.
- Supabase CLI warning appears during structural smoke when CLI is not installed.
- Electron builder reports duplicate dependency references for vite@8.1.3 during Windows package directory generation; packaging still completed.
- Linux rpm packaging is not configured; current Linux targets are AppImage and deb.
- macOS builds are currently local unsigned/not-notarized placeholders.

## 6. Required manual tests

### Windows

- Launch release/win-unpacked/Picom.exe.
- Confirm no native File/Edit/View menu appears.
- Confirm custom titlebar, minimize, maximize/restore, and close work.
- Confirm maximized mode removes frame padding/radius.
- Confirm mock community/channel/message flow works.
- Confirm Mention Feed, Profile Page, and Settings open.
- Confirm image preview opens.

### Linux

- Run npm run package:linux on Linux.
- Launch AppImage and/or installed deb.
- Confirm desktop entry, icon, titlebar, mock mode, and no mobile UI.

### macOS

- Run npm run package:mac on macOS.
- Launch app from dmg/zip.
- Confirm custom chrome behavior and permission prompt wording.
- Verify microphone/screen-recording permission flow.

### Supabase

- Install Supabase CLI.
- Run the documented Supabase local reset/RLS tests.
- Validate auth signup/login/session restore.
- Validate storage upload and private channel attachment access.
- Validate realtime message insert/update/delete across two windows.

### LiveKit

- Configure hosted or local LiveKit credentials.
- Join a voice room from two clients.
- Validate mute/deafen, speaking indicator, leave, and reconnect behavior.
- Validate screen source picker and start/stop screen share on Windows, Linux, and macOS.

## 7. Exact next fixes before wider beta

1. Install Supabase CLI and run the full reset/RLS test suite.
2. Run hosted Supabase API-mode smoke against real project credentials.
3. Run two-client realtime message and LiveKit voice/screen-share manual smoke.
4. Run Linux and macOS package smoke on real target platforms.
5. Reduce or intentionally budget the large renderer chunk before production.

## 8. Commands run

```text
npm run typecheck
npm run mock:smoke
npm run supabase:smoke
npm run livekit:smoke
npm run package:verify
npm run build
```

Additional package command run during the cross-platform package smoke task:

```text
npm run package:win:dir
```

## 9. Test results

- npm run typecheck: passed.
- npm run mock:smoke: passed.
- npm run supabase:smoke: passed with Supabase CLI missing warning for optional reset smoke.
- npm run livekit:smoke: passed.
- npm run package:verify: passed.
- npm run build: passed with Vite chunk-size warning.
- npm run package:win:dir: passed during package smoke task.

## 10. Changed files in this task

- docs/full-mvp-final-audit.md
- docs/task-checkpoints/task-full-mvp-final-audit.md

## 11. Commit

Commit will be created after this audit document is written:

```text
git commit -m "audit full mvp readiness"
```
