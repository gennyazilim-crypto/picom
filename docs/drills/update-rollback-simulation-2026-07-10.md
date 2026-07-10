# Desktop update rollback simulation - 2026-07-10

## Scope and safety

This development-only tabletop/state-machine drill used synthetic version `0.1.1-beta.1`. It did not contact an update service, download/write an artifact, run an installer, alter settings/local data, or affect a production user. Picom auto-update remains disabled.

Command: `npm run update:rollback:simulate`

## Scenarios and result

| Scenario | Simulated transitions | Result |
| --- | --- | --- |
| Stuck download | available -> downloading at 42% -> download_failed -> rollout paused | Pass; installed version retained, no artifact/installer action |
| Failed install | ready_to_install -> install_failed -> rollback_available_placeholder -> Safe Mode available | Pass; current installation retained, failure remains recoverable |
| Manual reinstall | pause -> verify prior signature/checksum -> backend minimum-version gate -> local-data downgrade gate -> manual reinstall required | Pass as procedure; no installer was executed |

## Recovery decisions

- A stalled/failed download does not change installed bytes and is not automatically retried indefinitely.
- An install failure pauses promotion, preserves diagnostics and leaves the current app available where the platform installer permits.
- Rollback is never just a feed pointer change: verify previous artifact signature/checksum/provenance, server minimum version and settings/cache migration compatibility first.
- If downgrade safety is unknown, prefer Safe Mode, kill switch/feature disablement or a forward hotfix.
- User messaging states that the current install was not changed and never asks for credentials.

## Blockers to a real package rollback drill

1. Production updater/provider and signed manifest are not enabled.
2. Approved signed/notarized current and previous artifacts are unavailable.
3. Protected internal device cohort and release/operations approvers are unassigned.
4. Windows/macOS signing and Linux repository evidence need real protected execution.
5. Cross-version backend minimum and local-data downgrade fixtures are not automated.
6. Installer telemetry/SLO and remote pause control are not production-connected.

## Required real drill later

On isolated internal Windows/macOS/Linux devices, install a known-good signed build, update to a synthetic bad candidate, exercise stuck download and failed install injection through an approved test provider, pause the channel, recover via prior signed artifact or forward hotfix, verify settings/session/chat compatibility, and confirm no unsafe retry. Preserve redacted evidence and do not reuse production user data.

## Outcome

The non-destructive state/recovery path passes. Real update rollback remains blocked and must not be represented as production-proven.
