# Picom 0.1.1-beta.1 Test Checklist

## Artifact identity

- [ ] About/Diagnostics shows `0.1.1-beta.1` and the beta release channel.
- [ ] Installer filename includes `0.1.1-beta.1`, platform, and architecture.
- [ ] SHA-256 is recorded after packaging and matches the distributed file.
- [ ] Candidate is stored only in the approved private beta location.

## Blocker regression focus

- [ ] `npm run env:smoke` passes with renderer-only example variables.
- [ ] `.env.example` contains no access token, service-role key, LiveKit secret, password, or authorization header.
- [ ] `npm run settings:diagnostics:smoke` verifies copy/export behavior without automatic submission.
- [ ] `npm run desktop:smoke` passes without introducing mobile navigation or layout.
- [ ] Feedback modal requires category, severity, summary, reproduction steps, expected result, and actual result.
- [ ] Copied diagnostics are redacted and contain version/platform/environment status only.

## Desktop smoke

- [ ] App starts with no renderer error.
- [ ] Login/register/session restore does not crash.
- [ ] Custom titlebar drag, minimize, maximize/restore, and close work.
- [ ] Normal and maximized window frame behavior remains correct.
- [ ] Light/dark theme switching remains correct.
- [ ] Community and channel switching work.
- [ ] Local message send works and the composer remains pinned.
- [ ] Mention Feed and Profile View open without a navigation dead-end.
- [ ] Settings, diagnostics, feedback, and log export surfaces open.

## Connected staging smoke

- [ ] Supabase auth uses the intended staging project and anon key only.
- [ ] Owner/member/visitor/private-channel RLS matrix passes.
- [ ] Two-window message insert/update/delete realtime test passes.
- [ ] Allowed image upload and private attachment access checks pass.
- [ ] LiveKit join/mute/deafen/leave passes with two clients.
- [ ] Screen-share picker and publish/stop behavior pass on the target OS.

## Installation lifecycle

- [ ] Upgrade over the previous approved beta succeeds.
- [ ] Clean install succeeds.
- [ ] Launch after install succeeds.
- [ ] Uninstall removes application binaries without deleting unrelated user files.
- [ ] Manual reinstall of the previous beta provides a usable rollback path.

## Release result

- [ ] Pass
- [ ] Fail
- [ ] Blocked by external environment

Record tester, date, platform, artifact hash, and linked issue IDs with the result.
