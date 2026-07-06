# Desktop Update Failure Recovery Plan

Production auto-update is intentionally disabled for the current Picom MVP, but the desktop app still needs a recovery plan for future updater integration and bad release handling.

This applies to Windows, Linux, and macOS desktop packages. Mobile is out of scope.

## Failure scenarios

### Failed download

- Symptoms: update check finds version but download fails or stalls.
- User message: “Update download failed. Your current Picom install was not changed.”
- Mitigation: keep current version running, retry later, check network/provider status.
- Logs: update service status, release channel, version, redacted network error.
- Rollout action: pause rollout if many clients fail download.

### Failed install

- Symptoms: package downloaded but install/apply step fails.
- User message: “Update install failed. Restart Picom normally or use Safe Mode if startup fails.”
- Mitigation: keep current version if possible, offer logs, safe mode on next startup if needed.
- Logs: installer/apply result, platform, build metadata, no secrets.
- Rollout action: pause rollout and verify package artifact/checksum.

### Corrupted update

- Symptoms: checksum/provenance mismatch, installer fails, app cannot start.
- Mitigation: remove artifact from release channel, publish known-good artifact, communicate affected versions.
- Verification: compare checksums and build provenance.
- Related: `docs/release-artifacts.md`, `docs/release-provenance.md`, `docs/rollback-runbook.md`.

### App fails after update

- Symptoms: startup crash, renderer error, safe mode triggered after update.
- Mitigation: safe mode, export redacted logs, rollback placeholder, hotfix if needed.
- Verification: desktop smoke on affected Windows/Linux/macOS package.

## Rollback to previous version placeholder

Future updater should support:

- Keeping previous artifact available.
- Pausing update channel.
- Serving previous known-good version if compatibility allows.
- Checking backend minimum client version before rollback.
- Preserving local settings/cache migration safety.

## Safe mode after update

If update causes repeated startup crashes:

1. Show crash recovery dialog.
2. Offer Safe Mode.
3. Disable optional services: realtime, tray, native notifications, updates, diagnostics-heavy features.
4. Offer export logs, reset settings, clear cache.
5. Keep chat UI as recoverable as possible.

## User messaging

Use plain desktop language:

- “The update could not be downloaded. Picom is still running your current version.”
- “The update could not be installed. Restart normally or use Safe Mode if Picom does not open.”
- “A rollback placeholder is available, but production auto-update is not enabled for this MVP build.”

Do not blame users or ask for passwords/tokens.

## Logs to collect

- App version and release channel.
- Platform: Windows, Linux, or macOS.
- Build date/commit placeholder.
- Update status: `download_failed`, `install_failed`, `rollback_available_placeholder`.
- Redacted diagnostics and recent logs.
- Artifact checksum/provenance if available.

## When to pause rollout

Pause rollout when:

- Download/install failure crosses SLO or rollout threshold.
- Corrupted artifact is suspected.
- Startup crash-free sessions drop below threshold.
- Backend compatibility issue appears.
- Support reports cluster around one platform/version.

## Hotfix procedure

1. Reproduce on affected platform.
2. Patch narrowly.
3. Run quality gate and desktop smoke.
4. Generate checksums/provenance.
5. Test install/launch on Windows/Linux/macOS in scope.
6. Release to internal ring first.
7. Resume beta/stable rollout gradually.

## Current implementation

- `updateService` can represent `download_failed`, `install_failed`, and `rollback_available_placeholder`.
- Settings > Advanced shows current update placeholder status and simulation actions.
- No real updater endpoint is required or enabled for MVP.
