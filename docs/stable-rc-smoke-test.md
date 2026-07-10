# Stable Release Candidate Smoke Test

Status date: 2026-07-10  
Overall result: **Not ready**

## Artifact matrix

| Platform | Artifact | Result |
| --- | --- | --- |
| Windows x64 | Unpacked app and NSIS installer generated in local temp | Build passed; clean-machine/UI smoke pending |
| Linux x64 | AppImage/deb | Not produced; native Linux host required |
| macOS x64 | DMG/zip | Not produced; macOS build/sign/notarization host required |

## Windows candidate evidence

- File: `Picom-0.1.1-beta.1-beta-Windows-x64.exe`
- Size: `121158333` bytes
- SHA-256: `3C38726EF2989049B37FB956E3452D93AF1E8C97BD57BEBF27E17D7DBA8A6248`
- Status: local unsigned beta-channel candidate, not a stable public artifact.

The unpacked executable handed off to an existing Picom dev instance through the single-instance lock and exited with code 0. This is not a clean-machine launch certification.

## Release pipeline checks

- Artifact naming contract: Passed.
- Checksum generation/verification contract: Passed.
- Provenance contract: Passed.
- RC dry-run contract: Passed.
- Consolidated local QA gate: Passed.
- TypeScript/mock/build: Passed in this release execution sequence.

## Core-flow status

Local/static contracts cover auth/session, onboarding, Mention Feed, profile, community/channel/message, permissions, emoji/replies, upload architecture, DM, settings, diagnostics, voice, and screen-share controls. The following artifact-level checks were not run:

- Installed login/register/logout against approved hosted Supabase.
- Installed upload/private access and two-window Realtime.
- Real LiveKit join/mute/deafen/speaking/reconnect.
- Remote screen-share start/stop.
- Windows clean-machine install/reinstall/uninstall.
- Linux/macOS install/launch/uninstall and native permissions.

## Decision

The RC is **Not ready**. Missing platform artifacts and hosted/private-access evidence are release blockers, not non-blockers. No distribution may occur from this result.
