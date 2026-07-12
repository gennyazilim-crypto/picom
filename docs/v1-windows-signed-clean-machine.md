# Picom V1 Signed Windows and Clean-Machine Evidence

Status: **BLOCKED**

This document records what was actually available on 2026-07-12. It does not certify an unsigned package and does not contain a certificate, password, token, private key, connection string or production credential.

## Candidate freeze

- Required release version: `1.0.0`
- Current `package.json` version: `0.1.1-beta.1`
- Frozen candidate commit: not assigned
- Release channel required by the protected workflow: `stable`
- Signed workflow run: none

The source cannot be called a V1 signed candidate until a full 40-character commit SHA whose package version is exactly `1.0.0` is approved and passed to the protected workflow. The workflow now checks out that exact SHA and fails closed on a mismatch.

## Signing capability audit

| Evidence | Result |
|---|---|
| Local `signtool.exe` | Not available |
| Current-user code-signing certificate | None found |
| Local CSC/signing variables | Not configured |
| GitHub `windows-production-signing` environment | Not found (GitHub API 404) |
| Protected signing secret/variable names | Not available because the environment does not exist |
| Prior signed workflow runs | None |
| Tracked signed installer | None |
| Valid Authenticode publisher/timestamp | Not available |

No SHA-256 is recorded because no signed artifact exists. A hash from an unsigned or pre-signing file would identify the wrong bytes and must not be inserted here.

## Prepared fail-closed controls

- Manual-only workflow with read-only repository permission.
- Protected environment and non-empty certificate/password/publisher checks.
- Exact full commit SHA checkout and verification.
- Exact `1.0.0` package version and `stable` channel verification.
- Quality gate and NSIS build before evidence generation.
- Authenticode status, approved publisher and trusted timestamp verification.
- SHA-256 and provenance generation only after successful signature verification.
- Expiring candidate artifact; no publishing or updater action.

These controls are readiness evidence, not proof that signing occurred.

## Clean Windows 10/11 matrix

Every row applies to the exact post-signing hash from the protected workflow.

| Flow | Windows 10 | Windows 11 |
|---|---|---|
| Download and independently verify SHA-256 | BLOCKED | BLOCKED |
| Verify Authenticode publisher and timestamp | BLOCKED | BLOCKED |
| Record SmartScreen text without bypassing Defender | BLOCKED | BLOCKED |
| Per-user install without elevation | BLOCKED | BLOCKED |
| First Launch Setup | BLOCKED | BLOCKED |
| Supabase register/login/logout/session restore to Feed | BLOCKED | BLOCKED |
| Feed and text community/channel navigation | BLOCKED | BLOCKED |
| Message, attachment, reply, reaction and read state | BLOCKED | BLOCKED |
| Profile avatar/cover persistence after restart | BLOCKED | BLOCKED |
| Friends and participant-only Direct Messages | BLOCKED | BLOCKED |
| User Settings, Community Admin, Help and diagnostics | BLOCKED | BLOCKED |
| Custom titlebar, window controls and no native menu | BLOCKED | BLOCKED |
| No mock/debug/post-V1 surfaces | BLOCKED | BLOCKED |
| Restart and session/settings persistence | BLOCKED | BLOCKED |
| Uninstall, retained user data, reinstall and explicit reset | BLOCKED | BLOCKED |

Voice Rooms and Screen Share are hidden by Task 621 and are not part of this V1 matrix.

## SmartScreen policy

A valid trusted signature establishes publisher identity and byte integrity but may not immediately have SmartScreen reputation. Record the exact warning/publisher text and certificate chain. Never advise disabling SmartScreen or Defender. A publisher mismatch, invalid/missing timestamp, invalid signature, unexpected helper binary, or hash mismatch is an immediate No-Go.

## User-data retention policy

`electron-builder.yml` sets `deleteAppDataOnUninstall: false`, so uninstall is intended to preserve local settings/session-related app data for reinstall. The clean-machine test must verify this behavior, verify server data is unaffected, and verify the in-app reset/clear controls provide the documented explicit deletion path. Do not claim retention or deletion behavior solely from configuration.

## Required closure

1. Create protected environment `windows-production-signing` with required reviewers.
2. Configure `WINDOWS_CSC_LINK`, `WINDOWS_CSC_KEY_PASSWORD` and `WINDOWS_PUBLISHER_SUBJECT` without printing values.
3. Set package/build metadata to `1.0.0`, select a full immutable SHA and dispatch the workflow.
4. Verify installer and installed executable signatures, publisher and timestamp.
5. Record the post-signing SHA-256 and provenance.
6. Exercise the full matrix on clean supported Windows 10 and 11 systems.
7. Attach redacted evidence and immutable workflow/artifact references.

RB-06 remains open until every required row passes.
