# Auto-update Architecture Placeholder

Picom does not enable production auto-update downloads in the current MVP. The app keeps an `updateService` placeholder so future updater work has a safe integration point without changing the desktop shell today.

## Current MVP behavior

- Auto-update is disabled by default.
- `updateService.getState()` reports the current app version, release channel, and disabled status.
- `checkForUpdatesPlaceholder()` can be called from future UI without downloading anything.
- Failure states can be represented with `download_failed` and `install_failed` placeholders.
- No update endpoint, signing certificate, or update manifest is committed.
- The beta enablement decision and staged rings are enforced by `docs/desktop-auto-update-beta-rollout.md`; the current decision is blocked, not silently enabled.

## Future integration points

### Electron

Future Electron builds can add an updater behind the existing service boundary. The renderer should continue using `updateService`; React components should not call native updater APIs directly.

### Release channels

Supported channel names should stay aligned with app config:

- `dev`
- `beta`
- `stable`

Each channel can eventually map to a separate update manifest URL from environment/remote config.

## Manifest placeholder

A future update manifest should include:

- app name: Picom
- platform: Windows, Linux, or macOS
- architecture
- version
- release channel
- artifact URL
- SHA256 checksum
- signature metadata placeholder
- minimum supported version placeholder
- release notes URL placeholder

## Safety requirements before enabling real updates

- Windows code signing plan is complete.
- macOS notarization/signing plan is complete.
- Linux package checksum/signature plan is complete.
- Rollback runbook exists and has been rehearsed.
- Update failure recovery UX is tested.
- Staged rollout controls exist for beta/stable channels.
- Remote config cannot inject arbitrary code or shell commands.

## User-facing behavior later

- Dev builds should never auto-install production updates.
- Beta builds may show update availability first, then require manual confirmation.
- Stable builds may support background checks after the user has opted into release updates.
- Failed downloads/install attempts should keep the current working app intact.
- Safe Mode should remain available after suspected update-related crashes.

## MVP non-goals

- No production auto-update.
- No updater endpoint.
- No signing keys or certificates.
- No forced update download.
- No provider lock-in.

## Manual verification

- Run `npm run typecheck`.
- Confirm `updateService` still reports `autoUpdateEnabled: false`.
- Confirm no Electron updater package is required for app startup.
- Confirm packaged builds do not require update credentials.
