# Picom Beta Distribution Portal and Process

Status: controlled beta process specification  
Public stable announcement: **not authorized**

## Tester entry point

Named testers receive the authenticated portal URL through the approved invitation channel:

`<PICOM_BETA_PORTAL_URL>`

The placeholder must be replaced only in the private tester communication/configuration system, not with credentials in Git. The portal may be an access-controlled artifact store or an approved private/draft release surface. It must not be an unauthenticated public download page.

The portal home page must show:

- Current approved beta version and channel.
- Candidate status: `testing`, `approved for ring`, `paused`, or `withdrawn`.
- Platform/architecture packages.
- SHA256SUMS and provenance downloads.
- Release notes and current known issues.
- Installation/uninstall guidance.
- Bug-report link and security escalation path.
- Last updated time and distribution owner placeholder.

## Download layout

Use immutable version/channel paths:

```text
<PICOM_BETA_PORTAL_URL>/beta/<version>/<platform>/<arch>/
```

Expected artifact names follow the release contract:

```text
Picom-<version>-<channel>-Windows-<arch>.exe
Picom-<version>-<channel>-Linux-<arch>.AppImage
Picom-<version>-<channel>-Linux-<arch>.deb
Picom-<version>-<channel>-macOS-<arch>.dmg
Picom-<version>-<channel>-macOS-<arch>.zip
SHA256SUMS.txt
provenance.json
```

Do not upload `.tmp` directories, unpacked build trees, `.env` files, source maps with private configuration, certificates, signing material, test passwords, logs, session data, or provider secrets.

Never replace bytes under an existing artifact name/checksum. Publish a new candidate version and mark the previous one withdrawn.

## Candidate publication process

1. Complete the platform-native package QA checkpoint.
2. Confirm the candidate commit/tag, package version, release channel, platform, and architecture.
3. Sign/notarize where the approved release ring requires it.
4. Generate checksums from final bytes: `npm run generate-checksums`.
5. Verify checksums: `npm run verify-checksums`.
6. Generate provenance: `npm run generate-provenance`.
7. Confirm provenance version/channel/commit and artifact hashes match the candidate.
8. Upload packages, checksums, provenance, release notes, known issues, and installation guide together.
9. Keep the candidate hidden until Go/No-Go and named ring approval.
10. Send the tester invitation with version, channel, test window, rollback contact, and report link.

## Tester download and verification

1. Sign in to the approved beta portal.
2. Confirm the build status is not `paused` or `withdrawn`.
3. Download only the package for the tester's platform/architecture plus `SHA256SUMS.txt` and `provenance.json`.
4. Verify SHA256 before installation.
5. Confirm provenance version/channel/platform/arch matches the filename and invitation.
6. Read [Beta release notes](beta-release-notes.md), [Known issues](known-issues.md), and [Beta installation guide](beta-installation-guide.md).
7. Stop and contact the beta coordinator when the checksum, publisher/notarization, version, or source is unexpected.

Testers must not disable Windows Security, Gatekeeper, Electron sandboxing, or Linux security controls globally. Unsigned internal packages must be labeled clearly and restricted to the approved ring.

## Bug reporting

Primary tracker placeholder:

`<PICOM_BETA_ISSUE_TRACKER>`

Recommended path:

1. Open Settings > Diagnostics.
2. Export redacted diagnostics/logs or prepare the in-app feedback report.
3. Inspect the export before attaching it.
4. Create a report using [Beta feedback triage](beta-feedback-triage.md).

Required report fields:

- Candidate filename, version, channel, and checksum.
- Windows/Linux/macOS version and package type.
- Mock, Supabase staging, or LiveKit staging mode.
- Reproduction steps, expected result, actual result, and frequency.
- Severity suggestion and workaround if known.
- Safe screenshot/video and redacted diagnostics when useful.

Never attach passwords, session/access tokens, authorization headers, Supabase service-role keys, LiveKit secrets, signing credentials, or unrelated private message content.

Private-channel leaks, exposed credentials, data loss, malicious native/deep-link behavior, broadly broken login/message send, package launch failure, or repeated critical crashes are immediate blockers. Pause distribution and use the incident path rather than a normal backlog report.

## Known issues process

The canonical user-facing list is [docs/known-issues.md](known-issues.md).

- Every approved candidate links the exact current known-issues revision.
- Blockers remain visible until a verified replacement candidate passes.
- Workarounds must be safe and must not disable OS security or expose data.
- Fixed issues move to release notes only after platform retest.
- Intentional out-of-scope features are labeled boundaries, not defects.

## Pause and withdrawal

When a blocker is confirmed:

1. Change candidate status to `paused` immediately.
2. Stop invitations and remove the package from the normal download listing while preserving restricted evidence.
3. Do not overwrite or delete checksum/provenance evidence needed for investigation.
4. Notify the active tester ring with affected version/platform, symptom, data-safety status, and next action.
5. Mark the candidate `withdrawn` after the rollback decision.
6. Revoke sessions or rotate staging credentials only when the incident requires it.

## Version rollback instructions

Before rollback, confirm the previous candidate is compatible with the current backend, database schema, RLS policies, remote config, and minimum-client-version rule. Export redacted diagnostics before resetting local state when safe.

### Windows

1. Quit Picom fully, including tray/background state.
2. Uninstall the affected candidate from Installed Apps.
3. Download the previous approved installer from the portal's rollback section and verify its checksum/provenance.
4. Install and run startup, session restore, theme, community/channel, message, and upload smoke.

### Linux

1. Quit Picom.
2. Replace the AppImage with the previous verified AppImage, or remove/install the approved deb version using the distribution package manager.
3. Do not manually delete unrelated user data.
4. Re-run desktop entry, launch, login, chat, voice, and Wayland/X11 checks as applicable.

### macOS

1. Quit Picom.
2. Remove the affected app from Applications without deleting user data unless explicitly required.
3. Download the previous signed/notarized approved DMG/zip and verify checksum, provenance, signature, and Gatekeeper state.
4. Reinstall and verify session/settings migration plus microphone/screen permission behavior.

If local data migrations are not backward compatible, do not instruct a downgrade. Pause and ship a forward hotfix or an explicitly reviewed recovery procedure.

Use [Rollback runbook](rollback-runbook.md) for backend/database/realtime decisions.

## Access and retention controls

- Grant portal access only to named testers and owners; review access after each ring.
- Expire invitation links and remove access when the test window ends.
- Keep previous approved rollback artifacts according to the release retention policy.
- Restrict withdrawn artifacts/evidence to engineering, security, and operations owners.
- Do not expose a directory listing that reveals private candidate names or internal diagnostics.
- Portal/download access logs must follow privacy and retention policy and must not contain tokens in URLs.

## Exit criteria

Beta distribution remains controlled until all of the following are recorded:

- Required platform package/install smoke passed.
- Checksum/provenance/signing evidence passed.
- Staging auth/message/upload/realtime tests passed.
- Required LiveKit voice/screen-share tests passed.
- Known blockers are zero or a formal No-Go remains in effect.
- Support, rollback, and incident contacts are staffed for the test window.

This process does not authorize a public stable announcement, public app-store listing, or production auto-update rollout.
