# Task 372 - Launch on startup placeholder

## Result
- Added a scoped `startupService` for local launch-on-startup placeholder settings.
- Added Settings > Advanced controls for launch on startup and start minimized to tray placeholders.
- Documented the deferred Electron main-process integration path.
- Added a focused smoke test so this placeholder remains service-based and does not expose Electron APIs to React.

## Changed files
- `src/services/startupService.ts`
- `src/components/SettingsModal.tsx`
- `docs/launch-on-startup.md`
- `scripts/launch-on-startup-smoke-test.mjs`
- `package.json`
- `docs/task-checkpoints/task-372-launch-on-startup-placeholder.md`

## Commands run
- `npm run startup:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## Manual verification
1. Run `npm run dev`.
2. Open Settings > Advanced.
3. Toggle launch-on-startup placeholder and start-minimized-to-tray placeholder.
4. Reopen Settings and confirm the local state persists.
5. Confirm no OS startup registration is created yet.

## Remaining notes
- Real startup registration remains intentionally deferred until the app has final packaging/signing behavior for Windows, Linux, and macOS.
