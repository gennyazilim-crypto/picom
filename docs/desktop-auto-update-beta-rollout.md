# Desktop auto-update beta rollout

## Decision

**Status: blocked pending explicit release and security approval.** Picom does not enable a production or beta auto-update endpoint in this task. `updateService.autoUpdateEnabled` remains `false`, no updater package is added, and no signing credential, private feed URL, or publish token is committed.

The current placeholder states remain useful for UI and recovery testing. They do not download, verify, install, or roll back an artifact.

## Enablement gates

All gates are required before a beta updater can be enabled:

- named Release and Security approvers;
- immutable HTTPS beta feed and documented provider ownership;
- Windows Authenticode signing with protected timestamped CI signing;
- macOS Developer ID signing, hardened runtime, entitlements review, notarization and stapling;
- Linux remains manual package/checksum distribution unless a separately reviewed signed repository/update mechanism is approved;
- signed manifest and artifact verification, SHA-256 checksum and release provenance;
- cross-version API/client compatibility and local-data migration tests;
- internal package smoke on each shipped platform and architecture;
- update failure, Safe Mode, crash recovery, pause and rollback rehearsal;
- monitoring/feedback owner and approved beta cohort.

Missing, invalid, expired, revoked, mismatched, or unverifiable signing evidence fails closed. Remote config and feature flags may pause availability but cannot authorize an unsigned artifact or arbitrary URL.

## Beta rings

| Ring | Cohort | Promotion gate | Automatic action |
| --- | --- | --- | --- |
| Disabled | All builds today | Default | None |
| Internal | Named Picom test devices | Signed artifact, clean install/update/rollback smoke | Check only; manual download confirmation |
| Beta 1% | Deterministic, anonymous installation bucket | Internal green for 48 hours and no blocker | Check only; manual install confirmation |
| Beta 10% | Approved beta cohort | Error/crash/install thresholds healthy for 72 hours | Manual confirmation |
| Beta 50% | Approved beta cohort | Support and operations approval | Manual confirmation |
| Beta 100% | All beta users | Go/no-go approval and known issues accepted | Manual confirmation |

Stable is not part of this rollout. Cohort assignment must be deterministic and privacy-safe; it must not use message content, contact graph, private community data, or raw device identifiers. Dev builds never consume beta/stable feeds.

## Manifest contract

The future signed beta manifest is public-safe and binds:

- Picom app ID, version, `beta` channel, platform and architecture;
- immutable artifact URL from an allowlisted HTTPS origin;
- artifact size, SHA-256 checksum and cryptographic signature metadata;
- build date, source commit/provenance reference and minimum compatible client/backend;
- release notes and published-at timestamp;
- rollout ID, percentage, pause state and expiry.

The renderer never selects a raw update URL and never invokes installers directly. Electron main/preload must expose only narrow check/download/install state actions after a separate security review.

## Failure recovery and pause

Pause immediately for signature/checksum/provenance mismatch, corrupted artifact, startup blocker, install failure spike, compatibility failure, suspected private-data leak, or security incident.

1. Stop manifest promotion and preserve evidence.
2. Keep the current working installation unchanged; never retry an unsafe install automatically.
3. Mark the release paused in remote config and release tracking.
4. Provide plain-language beta messaging and redacted diagnostics export.
5. Use Safe Mode after repeated post-update startup failure.
6. Publish a new signed hotfix/known-good artifact; never mutate an existing artifact/version.
7. Roll back only after checking backend minimum version and local-data migration compatibility.

See `docs/update-failure-recovery.md`, `docs/safe-rollout.md`, `docs/rollback-runbook.md`, and `docs/release-provenance.md`.

## Approval record template

- Candidate/version/channel:
- Feed/provider owner:
- Windows signing evidence:
- macOS signing/notarization evidence:
- Linux distribution decision:
- Internal smoke evidence:
- Compatibility/migration evidence:
- Rollback rehearsal:
- Monitoring/support owner:
- Release approval:
- Security approval:
- Decision and timestamp:

Until this record is complete, Picom remains on manual beta distribution and `autoUpdateEnabled: false`.
