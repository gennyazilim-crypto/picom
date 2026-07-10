# Install, Uninstall, and Reinstall QA

## Safety rules

- Run destructive install/uninstall tests on a disposable OS account or VM.
- Never point cleanup commands at an unverified/computed directory.
- Back up any test profile needed for migration validation.
- Do not use production credentials, signing secrets, or user content.
- App uninstall and local data deletion are separate actions.

Picom resolves local data through Electron's runtime `app.getPath("userData")`.
The Windows installer explicitly uses `deleteAppDataOnUninstall: false`, so an
ordinary uninstall preserves settings/session/cache for reinstall. A future
"remove local data" option must require separate, explicit confirmation.

## Windows NSIS matrix

1. Install the signed/approved candidate with the assisted wizard.
2. Verify default and custom install paths, Start Menu shortcut, desktop shortcut,
   one Picom process/window, custom titlebar, and app icon.
3. Complete first launch, close normally, and relaunch from each shortcut.
4. Install a newer compatible candidate over the existing version.
5. Verify settings/schema migration, first-launch completion, login restoration,
   window state safety, and application version.
6. Uninstall from Windows Apps.
7. Confirm binaries and shortcuts are removed but runtime user data is preserved.
8. Reinstall the same approved candidate and verify preserved settings load safely.
9. Use Picom's explicit reset/clear controls to test a clean profile separately.

Do not manually delete `%APPDATA%` broadly. Resolve and verify Picom's exact
`app.getPath("userData")` value in the test build before any cleanup.

## macOS matrix

1. Mount the signed/notarized DMG and drag Picom to Applications.
2. Verify icon, Gatekeeper/notarization, first launch, permission explanations,
   custom titlebar, and relaunch.
3. Replace the app with a newer compatible version and verify local migration.
4. Remove only `Picom.app`; confirm user data remains unless separately cleared.
5. Reinstall and verify the expected profile/session behavior.

## Linux matrix

### AppImage

- Make executable, launch from terminal and desktop integration, then remove the
  AppImage file. Confirm only the binary is removed and user data remains.

### DEB

- Install, upgrade, remove, reinstall, and purge on a disposable Debian-based VM.
- Verify desktop entry, icon, executable, dependencies, and package ownership.
- `remove` should preserve configuration; `purge` behavior must be explicitly
  reviewed before claiming local-data deletion.

## Reinstall and compatibility expectations

- Same/newer compatible versions migrate local settings forward.
- Corrupt settings fall back safely and preserve a redacted backup where possible.
- Downgrades are not guaranteed; use the rollback runbook and compatibility matrix.
- Auth secrets are not part of local settings migration/reset tooling.
- Uninstall does not delete server-side accounts, communities, or messages.
- Account deletion is a separate authenticated backend workflow.

## Evidence to capture

- Artifact name and SHA256
- OS/build and architecture
- install/upgrade/uninstall/reinstall result
- shortcut/menu evidence
- first-launch and relaunch result
- preserved/cleared data expectation
- redacted logs and screenshots
- blocker/non-blocker classification and owner

## Current execution status

Configuration and package smoke checks run on Windows. Automated uninstall or
profile deletion was intentionally not run against the developer workstation.
Full clean-account Windows installation plus native macOS and Linux matrices are
release-candidate blockers before public distribution.

## Task 399 Windows update

Signing and installer process contracts passed, but no trusted signed artifact or clean Windows VM/device evidence was available. Install, core-flow, uninstall, retention, and reinstall remain pending against the final signed checksum.

## Task 400 Linux update

Package metadata and distribution controls passed structurally. Native AppImage removal and deb install/remove/purge/reinstall behavior were not run because this is a Windows host.
