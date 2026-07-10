# Task 135 - System Tray Production

## Result

Completed. Tray Open, Quit, status, mute, and settings behavior remains intact. A default-off close-to-tray preference now synchronizes through the service/preload/main boundary, hides only when a real tray exists, and cannot intercept explicit/OS quit.

## Changed files

- `electron/ipcChannels.cts`
- `electron/main.cts`
- `electron/preload.cts`
- `src/types/picomDesktop.d.ts`
- `src/services/trayService.ts`
- `src/App.tsx`
- `src/components/SettingsModal.tsx`
- `scripts/tray-integration-smoke-test.mjs`
- `docs/desktop/system-tray-production.md`
- `docs/task-checkpoints/task-135-system-tray-production.md`

## Verification

- `npm run tray:integration:smoke`
- `npm run renderer:native:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

Final tray assets and OS behavior still require installed Windows/Linux/macOS artifact testing. Start-minimized is unchanged and remains a placeholder.
