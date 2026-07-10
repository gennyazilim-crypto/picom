# System Tray Production

## Behavior

Picom's Electron main process owns `Tray`, native `Menu`, window focus/restore, and final quit. Renderer code uses only `trayService` through the narrow context-isolated preload bridge.

The menu provides Open Picom, Online/Idle/Do Not Disturb/Invisible status, Mute Notifications, Settings, and Quit. Status/mute changes are sent to renderer as validated typed actions; mute updates the centralized notification setting.

## Close to tray

Close to tray is off by default and stored as a non-sensitive local preference. Settings calls `trayService`, which synchronizes a boolean through the whitelisted preload IPC channel.

When enabled and a native tray was created successfully, closing the main window hides it instead of destroying it. Open Picom, tray click, second-instance activation, and macOS activation restore/focus it. Quit sets an explicit quitting guard and exits normally; `before-quit` also prevents close interception during OS/application shutdown.

If tray creation is unsupported or fails, close is not intercepted. Browser fallback stores the preference safely but reports no native support. The user is never trapped without a Quit path.

## Icon and menu safety

Main loads `assets/brand/app-icon.png`; an empty/unavailable image and Tray constructor failure are caught without crashing startup. The menu is built from fixed host actions and never executes renderer-provided commands. Preload validates status/action payloads and exposes no raw Electron object.

Platform packaging may require dedicated tray variants:

- Windows: ICO/multi-resolution and notification-area scaling.
- Linux: desktop environment/status notifier support varies; AppImage/deb metadata and click behavior need target-distribution testing.
- macOS: a monochrome template image is recommended for menu-bar appearance; dock activation must restore hidden windows.

The current PNG is a safe functional fallback, not final proof of ideal platform rendering.

## Lifecycle and unsupported behavior

- Tray creation is idempotent.
- Hidden windows remain alive, preserving realtime/session state.
- Quit always terminates instead of hiding again.
- `window-all-closed` retains normal platform behavior when no hidden window exists.
- Safe mode does not synchronize optional close-to-tray behavior.
- No tray failure blocks auth, chat, diagnostics, or a normal close.

## Verification

Run `npm run tray:integration:smoke`, `npm run renderer:native:smoke`, `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.

Installed artifact checks on each platform:

1. Icon/menu appears without black/empty artifacts.
2. Open restores and focuses minimized/hidden window.
3. Every status updates app presence and checked menu state.
4. Mute updates settings and notification routing.
5. Settings opens the desktop modal.
6. Close-to-tray off closes normally; on hides only when tray exists.
7. Quit exits with close-to-tray enabled.
8. Second instance/deep link restores hidden window.
9. Explorer/desktop shell restart, unsupported tray, sleep/wake, logout, and app shutdown do not crash or trap a process.

## Remaining production gates

Structural tests cannot prove OS tray behavior. Final Windows ICO, macOS template asset, representative Linux desktop certification, shell-restart behavior, and packaged installer tests remain required. Start-minimized remains a separately documented placeholder and is not activated by this task.
