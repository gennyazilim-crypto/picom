# Task 371 - Real system tray integration

## Result
- Verified the existing Electron Tray/Menu bridge is active in the main process.
- Connected native tray actions to the renderer through `trayService.onAction()`.
- Tray `Settings` opens the existing Settings modal through the overlay state.
- Tray `Mute Notifications` updates local notification settings through `settingsService`.
- Tray presence actions update the current mock user's desktop presence/status text.
- Added a focused static smoke test for the full main -> preload -> service -> app tray path.

## Changed files
- `src/App.tsx`
- `scripts/tray-integration-smoke-test.mjs`
- `package.json`
- `docs/task-checkpoints/task-371-real-system-tray-integration.md`

## Commands run
- `npm run tray:integration:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## Manual verification
1. Run `npm run dev`.
2. Confirm the Picom tray icon appears in the OS tray/menu bar area.
3. Open the tray menu and choose `Open Picom`; the window should focus/restore.
4. Choose each status under `Set Status`; the current user's status in the desktop shell should update.
5. Toggle `Mute Notifications`; notification settings should persist locally.
6. Choose `Settings`; the Settings modal should open.
7. Choose `Quit`; the app should quit through the native Electron main process.

## Remaining notes
- Some Linux desktop environments hide tray icons unless an app indicator/tray extension is enabled.
- The tray icon uses the existing Picom placeholder app icon and exposes no raw Electron objects to React.
