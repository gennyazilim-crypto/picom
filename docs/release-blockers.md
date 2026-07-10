# Stable Release Blockers

Status: **Open**  
Stable decision: **No-Go until all mandatory blockers are closed**

## Critical release blockers

| ID | Blocker | Required closure evidence | Owner |
| --- | --- | --- | --- |
| RB-01 | Hosted Supabase role/isolation matrix has not run against an approved staging/production-like project | Anonymous/visitor/member/mod/admin/owner tests pass for private/public communities, channels, messages, attachments, profile activity, Mention Feed, and DMs | Security/backend owner |
| RB-02 | Private Storage and historical attachment signed-URL refresh are not production-proven | Unauthorized reads fail; authorized reload/refresh/download works without public-path leakage | Storage owner |
| RB-03 | Hosted Realtime and Edge Functions are not production-proven | Two-client insert/update/delete/deduplication and Edge token/auth tests pass without service-role exposure | Backend owner |
| RB-04 | LiveKit voice is not certified with real clients/devices | Two clients join, mute/deafen/speaking/reconnect/leave pass; unauthorized room joins fail | Realtime owner |
| RB-05 | Screen sharing is not certified on all promised platforms | Explicit source selection, permission denial/retry, remote display, stop, and cleanup pass on Windows/Linux/macOS | Desktop owner |
| RB-06 | Windows clean-machine installer evidence is missing | Install, first launch, core flow, reinstall, uninstall, checksum, and unsigned/signed behavior recorded | Release owner |
| RB-07 | Linux native packages are not built/smoked on Linux | AppImage and deb install/launch/core-flow/uninstall pass on supported distributions | Linux release owner |
| RB-08 | macOS artifacts are not built, signed, notarized, and smoked on macOS | DMG/zip, Gatekeeper, microphone/screen-recording permissions, launch/core-flow/uninstall pass | macOS release owner |
| RB-09 | Production environment and secret ownership are not frozen | Named owner, protected stores, approved renderer-safe values, deployed targets, and rotation/rollback path recorded | Operations owner |
| RB-10 | Legal/privacy documents lack final legal sign-off | Terms, Privacy, Guidelines, AUP, support/reporting, deletion/export wording, versions, and in-app links approved | Legal/product owner |
| RB-11 | Backup/restore and destructive data lifecycle are not production-proven | Staging restore drill passes; deletion/export paths have legal/operations approval | Database/privacy owner |

## High-priority non-blockers

- Initial renderer chunk remains above the preferred bundle warning threshold.
- Some native accessibility, multi-monitor, DPI, memory, and cold-start evidence remains manual.
- OAuth providers, 2FA, Steam, and Epic remain disabled or deferred and must not be advertised.
- Production auto-update remains outside stable scope.
- Unsigned local artifacts are suitable only for internal testing.

## Reclassification rule

A blocker may move to non-blocker only with a written risk acceptance, named owner, user-facing limitation, rollback/kill-switch path, and evidence that core privacy/security/data integrity is unaffected. Missing evidence alone is never justification for reclassification.

## Task 396 evidence update

Local Supabase/RLS/API/secret-boundary and build gates passed on 2026-07-10. Hosted staging was not configured or authenticated, so RB-01, RB-02, and RB-03 remain open without reclassification.

## Task 397 evidence update

LiveKit service, device, reconnect, mini-card, discovery, and diagnostics contracts passed locally. No hosted token or two-client media session ran, so RB-04 remains open.

## Task 398 evidence update

Screen-share permission recovery, preview/stop, preload, and IPC validation passed. Packaged remote-view evidence on Windows and native Linux/macOS evidence are absent, so RB-05 remains open.

## Task 399 evidence update

Windows packaging and fail-closed signing controls passed without loading a certificate. No signed artifact or clean-machine matrix exists, so RB-06 remains open.

## Task 400 evidence update

Linux packaging and repository-distribution contracts passed, but no native AppImage/deb was built or launched. RB-07 remains open.

## Task 401 evidence update

macOS notarization/signing workflow controls passed, but no native build, Developer ID signature, notarization, staple, Gatekeeper, or permission matrix ran. RB-08 remains open.
