# Picom 0.1.1-beta.1 Patch Release Notes

## Release identity

- Version: `0.1.1-beta.1`
- Channel: beta
- Product: Picom desktop community chat
- Distribution: private beta only
- Signing: unsigned local beta candidate

## Fixed blockers

- Removed Supabase CLI-only variables from the renderer `.env.example` so access tokens and project-linking values cannot be mistaken for Vite configuration.
- Aligned environment QA with the renderer-safe OAuth and LiveKit availability flags used by `appConfig`.
- Aligned Settings diagnostics smoke coverage with the manual, redacted report-copy flow; no automatic support upload was added.
- Removed a desktop-only QA false positive caused by comment wording without changing UI behavior.
- Added structured beta feedback categories, severity, reproduction steps, and redacted environment context.

## Affected platforms

- Windows x64: candidate can be built with the existing NSIS pipeline on Windows.
- Linux x64: source/build validation applies; AppImage/deb must be produced and tested on Linux.
- macOS x64: source/build validation applies; dmg/zip, signing, permission, and notarization checks require macOS.

## Beta tester focus

1. Launch and complete login/session restore.
2. Open Settings diagnostics and verify `0.1.1-beta.1` with the beta channel.
3. Prepare a feedback report with category, severity, reproduction steps, expected result, and actual result.
4. Confirm diagnostics/log inclusion remains opt-in and the copied report contains no credentials.
5. Recheck community/channel navigation, local messaging, titlebar controls, Mention Feed, profile view, voice entry, and screen-share picker.

## Known remaining issues

- Windows candidates are unsigned and can trigger SmartScreen warnings.
- Linux and macOS packaging and native smoke tests require their respective native hosts.
- Supabase RLS, Storage, Realtime, OAuth, and LiveKit require configured staging environments for connected verification.
- Vite reports a non-blocking chunk-size warning; code splitting remains future optimization work.

See [Beta Known Issues](./beta-known-issues.md) for the maintained list.

## Install and upgrade

1. Close all running Picom windows before installing.
2. Verify the candidate filename, version, and SHA-256 supplied with the artifact.
3. Run the installer as the current user; administrator elevation is not required.
4. Install over the previous beta when testing upgrade behavior, then repeat with a clean install if a problem appears.
5. Do not disable operating-system security globally to bypass an unsigned-app warning.

## Rollback

Picom has no production auto-update in this release. If rollback is required, close Picom, uninstall the patch, and manually reinstall the previously approved beta artifact. Preserve user diagnostics before uninstalling and do not delete local data unless the test plan explicitly requires a clean-state run.
