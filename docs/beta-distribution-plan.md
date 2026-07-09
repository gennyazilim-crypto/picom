# Picom Beta Distribution Plan

## Purpose

This plan controls distribution of the Picom Full MVP desktop beta for Windows, Linux, and macOS. It does not authorize a public open beta. Distribution starts only after the canonical [Beta Go / No-Go](beta-go-no-go.md) record is changed from `NO-GO` by the required owners.

## Release channel and audience

| Ring | Audience | Entry condition | Exit condition |
| --- | --- | --- | --- |
| Internal | Picom engineering, QA, product, and support testers | Target-platform package launches; no known secret/private-data leak | Core flow smoke complete; blockers triaged |
| External small group | Named, invited testers under an approved beta agreement | Formal `GO` or `GO WITH NON-BLOCKERS`; internal ring stable | Agreed test window complete; no new critical blocker |
| Public open beta | Not authorized | Requires a separate future decision | Not applicable |

The release channel is `beta`. Testers must not redistribute artifacts, staging credentials, logs, or private test content.

## Distribution bundle

Publish each approved candidate in the controlled download location placeholder:

`<INTERNAL_BETA_DOWNLOAD_LOCATION>/<version>/<platform>/`

The bundle must contain:

- Windows installer or approved unpacked beta package
- Linux AppImage and/or deb package
- macOS dmg and/or zip package
- SHA-256 checksums when available
- Build provenance metadata when available
- [Beta release notes](beta-release-notes.md)
- [Beta known issues](beta-known-issues.md)
- Platform smoke-test instructions

Do not publish incomplete `.tmp` packaging directories. Do not include `.env` files, certificates, API secrets, session data, test-user passwords, or source maps containing private values.

## Backend environment

- The candidate must use the approved Supabase staging URL placeholder: `<PICOM_STAGING_SUPABASE_URL>`.
- The candidate must use the approved LiveKit staging URL placeholder: `<PICOM_STAGING_LIVEKIT_URL>`.
- The Supabase anon/publishable key may be distributed only through the approved build/configuration flow; the service-role key must never enter the renderer or distribution bundle.
- LiveKit API keys/secrets remain server-side in the token function environment.
- Testers must not point a beta build at production services.

Follow [Supabase staging setup](supabase-staging-setup.md) and [LiveKit staging setup](livekit-staging-setup.md) before creating the candidate.

## Account creation

1. The beta coordinator confirms staging registration is enabled and legal acceptance is present.
2. Internal testers register with approved test email addresses or receive named staging accounts through a secure channel.
3. External testers receive an invitation and register from the Picom sign-up screen.
4. Google/Apple login is offered only when the provider and `picom://auth/callback` redirect have passed staging smoke tests.
5. Testers complete first-run onboarding and must not reuse production passwords.

## Windows installation

1. Download the approved `Picom-<version>-Windows-x64.exe` and checksum.
2. Verify the checksum before opening the installer.
3. Expect a SmartScreen/unsigned publisher warning for an approved unsigned internal beta.
4. Do not disable Windows Security globally; stop and contact the beta coordinator if the artifact origin or checksum is uncertain.
5. Install per-user, launch Picom, and confirm the custom titlebar appears without the native File/Edit/View menu.

Use [Windows smoke test](windows-smoke-test.md) for the full platform gate.

## Linux installation

### AppImage

```bash
chmod +x Picom-<version>-Linux-x86_64.AppImage
./Picom-<version>-Linux-x86_64.AppImage
```

### Debian package

```bash
sudo apt install ./Picom-<version>-Linux-amd64.deb
```

Verify the artifact checksum first. Record distribution, desktop environment, Wayland/X11 session, and PipeWire/portal details in voice or screen-share reports. Use [Linux smoke test](linux-smoke-test.md).

## macOS installation

1. Download the approved dmg or zip and checksum.
2. Verify the checksum.
3. Install or move Picom to Applications as directed by the artifact.
4. An unsigned internal beta may trigger Gatekeeper. Follow only the beta coordinator's approved local-test procedure; do not disable macOS security globally.
5. Grant microphone and screen-recording permissions only when testing voice/screen share.
6. Restart Picom after changing screen-recording permission if macOS requests it.

Use [macOS smoke test](macos-smoke-test.md). Signing/notarization remains a release gate, not a secret bundled with the app.

## Required tester checklist

- [ ] Launch Picom and verify the custom desktop shell/window controls.
- [ ] Register, log in, log out, restart, and verify session restore.
- [ ] Complete onboarding and open/edit the Full Profile Page.
- [ ] Create or join a community and switch channels.
- [ ] Send, edit, delete, reply to, and react to a message.
- [ ] Upload a valid image and open Image Preview.
- [ ] Open Mention Feed, switch both tabs, open a story, and inspect the companion rail.
- [ ] Test owner/admin/moderator/member/visitor community menus when assigned.
- [ ] Verify visitor public-read behavior and inability to send before joining.
- [ ] Join LiveKit voice with another client; test mute, deafen, speaking, reconnect, and leave.
- [ ] Start and stop screen share using the Electron source picker.
- [ ] Export redacted diagnostics and submit one test feedback report.

## Reporting bugs

Use the approved internal tracker placeholder: `<PICOM_BETA_ISSUE_TRACKER>`.

Every report must include:

- Candidate version and release channel
- Operating system/version and package type
- Mock, Supabase staging, or LiveKit staging mode
- Clear reproduction steps
- Expected and actual result
- Frequency and severity
- Screenshot/video when safe
- Redacted diagnostics export

Report private-channel leaks, exposed credentials, data loss, login-wide outages, package launch failure, or repeated critical crashes immediately as release blockers. Do not paste private message content or secrets into the tracker.

## Exporting diagnostics

1. Open Picom Settings.
2. Open Advanced or Diagnostics.
3. Review the redacted summary.
4. Select Export Diagnostics or Export Logs.
5. Inspect the exported file before attaching it.
6. Remove unrelated private content and report any failed redaction as a security blocker.

## Uninstall

### Windows

Use Windows Settings > Apps > Installed apps > Picom > Uninstall. Confirm whether user settings/cache remain and record the result in the smoke test.

### Linux

Delete the AppImage for a portable test. For deb installs, use the distribution package manager, for example `sudo apt remove picom`. Do not manually delete unrelated application data.

### macOS

Quit Picom and move Picom from Applications to Trash. Remove local test data only when the smoke checklist explicitly requires a clean reinstall.

Uninstall does not automatically revoke a staging session. Testers should log out first where possible; the coordinator may revoke sessions after a ring ends.

## Updating to the next beta

Production auto-update is not included. For each beta:

1. Read the new release notes and known issues.
2. Quit Picom fully, including tray/background state.
3. Verify the new artifact checksum.
4. Install the new candidate using the platform procedure.
5. Preserve settings only when the release notes permit an in-place upgrade.
6. Re-run startup, session restore, migration, and core chat smoke checks.

## Rollback and reinstall

1. Stop distribution immediately if a blocker appears.
2. Remove the affected download and mark it withdrawn; do not silently replace an artifact under the same version/checksum.
3. Notify the current test ring with impact and safe next action.
4. Quit and uninstall the affected candidate.
5. Install the last approved candidate only if client/server compatibility is confirmed.
6. If local state is suspected, export redacted diagnostics before reset, then follow the approved clean-reinstall procedure.
7. Revoke affected sessions or staging credentials server-side when security requires it.
8. Record the rollback decision and retest evidence before resuming distribution.

## Known risk areas

| Risk | Required control |
| --- | --- |
| Screen-share permissions and source selection | Native OS test; denial/retry/stop paths; no crash |
| macOS microphone and screen recording | Native permission testing and documented restart/re-approval steps |
| Linux Wayland/PipeWire variation | Record distro/session and test target packages natively |
| Supabase staging limits/outage | Use staging only; monitor auth/realtime/storage; preserve mock fallback for local diagnosis |
| LiveKit staging limits/outage | Two-client smoke; token function health; reconnect/failure-state test |
| Unsigned packages | Restricted tester group, checksum verification, explicit warnings |
| Private-channel/RLS isolation | Separate-account staging tests; any leak is immediate `NO-GO` |

## Distribution authorization

- Candidate version:
- Ring: `Internal | External small group`
- Go/No-Go record:
- Artifact/checksum location:
- Supabase staging owner:
- LiveKit staging owner:
- Distribution owner:
- Support owner:
- Start date/time:
- Withdrawal deadline/contact:

