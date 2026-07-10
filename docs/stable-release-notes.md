# Picom Stable Release Notes

Release state: **Release candidate only - not distributed**  
Current candidate version: `0.1.1-beta.1`  
Final stable version/channel: Pending Go decision

Picom is a premium Electron desktop community chat application for Windows, Linux, and macOS. The local release candidate is available only for controlled validation. There is no approved public stable download while the Go/No-Go decision remains No-Go.

## Included product areas

- Custom Electron desktop shell, titlebar, light/dark themes, Picom design tokens, and Coolicons/AppIcon UI.
- Login, registration, logout, session restore, first-run onboarding, profile editing, and policy acceptance flows.
- Mention Feed, followed-user stories, profiles, follows, saved/read state, and companion rail.
- Communities, channels, role-aware controls, visitor read-only mode, messages, replies, emoji/reactions, image attachments, and previews.
- Direct Messages with participant-only data/RLS foundations.
- Settings, privacy/safety, diagnostics, redacted logs, accessibility, and support feedback surfaces.
- LiveKit voice and explicit Electron screen-share source-selection foundations.

## Supported platform status

| Platform | Intended format | Current release evidence |
| --- | --- | --- |
| Windows x64 | NSIS installer | Local unsigned beta candidate generated; clean-machine smoke pending |
| Linux x64 | AppImage and deb | Native Linux build/install smoke pending |
| macOS x64 | DMG and zip | macOS build/sign/notarization smoke pending |

Mobile UI/application is not included.

## Known release blockers

- Hosted Supabase Auth/RLS/Storage/Realtime/Edge validation is incomplete.
- Real two-client LiveKit and remote screen-share certification is incomplete.
- Clean Windows, native Linux, and signed/notarized macOS install/launch/uninstall evidence is incomplete.
- Production environment owners/targets and final stable version are not frozen.
- Terms, Privacy, Guidelines, AUP, and retention wording require approved final documents and legal review.
- Backup restore and destructive data-lifecycle rehearsal remain pending.

## Windows candidate verification

The local candidate is not a public stable artifact:

- File: `Picom-0.1.1-beta.1-beta-Windows-x64.exe`
- SHA-256: `3C38726EF2989049B37FB956E3452D93AF1E8C97BD57BEBF27E17D7DBA8A6248`

Only install artifacts received from the approved Picom release location. Compare the published checksum before running an installer. Unsigned internal builds can trigger Windows warnings; do not disable operating-system security globally.

## Installation and uninstall notes

- Windows: use the approved NSIS installer; the per-user setup supports a selectable install directory and desktop/Start Menu shortcuts.
- Linux: AppImage/deb instructions will be published after native package certification.
- macOS: DMG/zip instructions will be published only after signing/notarization and Gatekeeper verification.
- Before uninstalling, export any local drafts/diagnostics needed for support. Authentication sessions and local cache handling follow the product privacy/deletion policy, not installer deletion assumptions.

## Voice and screen sharing

Voice and screen-share code paths are present, but production certification is incomplete. Screen capture starts only after explicit user source selection. Linux desktop-session behavior and macOS microphone/screen-recording permissions require native validation.

## Privacy, legal, and support

- Picom does not claim production end-to-end encryption.
- Private data protection depends on deployed Supabase RLS and Storage policies.
- Diagnostics/log exports are redacted, but users should review files before sharing.
- Legal gate status: `docs/legal-policy-final-gate.md`.
- Known blockers: `docs/release-blockers.md`.
- Report issues with version, operating system, reproduction steps, expected/actual result, and optional redacted diagnostics. Never send passwords, session tokens, private keys, or service-role credentials.

## Distribution status

No public stable distribution is authorized by these notes. Publication requires a recorded Go decision, final artifacts for every promised platform, checksums/provenance, approved legal links, and rollback/support readiness.

## Task 405 release-candidate status

The blocker-closure pass completed on 2026-07-10 with a **No-Go** decision. Local deterministic gates passed, but hosted, native-platform, legal, ownership, and restore evidence remain incomplete. No new stable download, checksum, provenance claim, or release announcement was produced.
