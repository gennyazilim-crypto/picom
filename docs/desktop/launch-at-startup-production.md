# Launch at Startup Production

## Behavior

Launch at startup is disabled by default and changes only after an explicit user toggle in Settings > Advanced. `startupService` owns renderer behavior; preload exposes only typed `getState` and `setEnabled(boolean)` methods; Electron main owns OS registration.

No React component imports Electron or writes registry, LaunchAgent, or autostart files.

## Platform support

- **Packaged Windows:** main uses Electron `app.setLoginItemSettings({ openAtLogin, path: process.execPath })` and reads back `getLoginItemSettings().openAtLogin`.
- **Packaged macOS:** uses the same Electron login-item API. Signed/notarized installed bundle behavior must be tested; macOS may expose controls in System Settings.
- **Linux:** current bridge returns unsupported and writes no XDG autostart file. Distribution/desktop-environment ownership, uninstall cleanup, path changes, and Flatpak/Snap portals require a separate implementation review.
- **Dev/unpackaged:** registration is refused to avoid launching an Electron development executable or stale script path at login.

## State and failure

Settings refreshes native state when opened. A successful native update is read back before being shown as enabled. Failure/unsupported state clears the enabled and start-minimized preferences and displays safe copy. Browser/mock mode keeps a local placeholder preference without native effects.

The preference contains no auth/session data or secrets. Disable and reset use the same native API. The OS remains authoritative if the user changes startup permission externally.

## Start minimized

`Start minimized to tray` remains a local placeholder and can be selected only when launch-at-startup succeeds. It does not yet alter BrowserWindow startup visibility. Close-to-tray is separate and already user-controlled; neither behavior is forced.

## Verification

Run `npm run startup:smoke`, `npm run renderer:native:smoke`, `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.

Installed artifact checks:

1. Fresh install has startup disabled.
2. Enable, sign out/reboot, verify exactly one Picom launch.
3. Disable, sign out/reboot, verify no launch.
4. Change OS setting externally, reopen Settings, verify refreshed state.
5. Upgrade/move/uninstall and confirm no stale entry.
6. Verify standard-user behavior and no elevation prompt.
7. Confirm dev and Linux return safe unsupported behavior.
8. Confirm no passwords, tokens, or account details enter startup configuration/logs.

## Remaining gates

Structural tests do not prove OS login behavior. Signed Windows and macOS installers require clean-machine login/reboot, update, uninstall, path-change, multi-user, and OS-settings tests. Linux support remains intentionally unimplemented rather than writing an unreviewed autostart file.
