# Launch on Startup Placeholder

Picom prepares launch-on-startup behavior behind a renderer service without enabling OS startup registration yet.

## Current behavior

- Renderer service: `src/services/startupService.ts`
- Settings entry: Settings > Advanced
- Stored locally under `picom-startup-settings`
- Native mode: `placeholder`
- Default: disabled

The service exposes:

- `isLaunchOnStartupEnabled()`
- `setLaunchOnStartupEnabled(enabled)`
- `toggleLaunchOnStartup()`
- `setStartMinimizedToTray(enabled)`
- `reset()`

## Safety rules

- The app does not register itself to launch on system startup by default.
- The renderer does not call Electron APIs directly.
- No login item, registry key, launch agent, or autostart desktop entry is written in this placeholder task.
- The setting is local-only and does not include passwords, tokens, sessions, or secrets.
- `Start minimized to tray` automatically enables the local launch-on-startup placeholder so the user sees a coherent state.

## Future Electron integration

When production startup behavior is approved, add a narrow preload bridge to the Electron main process and call Electron's supported API there:

- Windows/macOS: `app.setLoginItemSettings()` from the main process.
- Linux: document desktop-environment-specific support before writing any autostart file.

The future bridge should return safe result objects and never expose raw Electron APIs to React.

## Manual verification

1. Run `npm run dev`.
2. Open Settings > Advanced.
3. Toggle `Launch Picom on startup placeholder`.
4. Toggle `Start minimized to tray placeholder`.
5. Close and reopen Settings; the local state should persist.
6. Confirm Picom does not actually add an OS startup entry yet.
