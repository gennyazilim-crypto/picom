# Task 136 - Launch at Startup Production

## Result

Completed. Launch-at-startup is disabled by default, user-controlled, and implemented through a typed service/preload/main boundary for packaged Windows/macOS. Dev and Linux fail safely without writing startup entries. Settings refreshes and reports native state.

## Changed files

- `electron/ipcChannels.cts`
- `electron/main.cts`
- `electron/preload.cts`
- `src/types/picomDesktop.d.ts`
- `src/services/startupService.ts`
- `src/components/SettingsModal.tsx`
- `scripts/launch-on-startup-smoke-test.mjs`
- `docs/desktop/launch-at-startup-production.md`
- `docs/task-checkpoints/task-136-launch-at-startup-production.md`

## Verification

- `npm run startup:smoke`
- `npm run renderer:native:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

Start-minimized remains a local placeholder. Installed signed Windows/macOS login/reboot/update/uninstall tests and a reviewed Linux implementation remain open production gates.
