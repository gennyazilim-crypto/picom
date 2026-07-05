# Task 369 Checkpoint: Actual Desktop Protocol Handler Wiring

## Status

Completed native Electron protocol handler preparation for `picom://` links with route allowlisting, package metadata, macOS `open-url`, second-instance forwarding, and renderer-safe preload delivery.

## Changed files

- `electron/main.cts`
- `electron/preload.cts`
- `electron-builder.yml`
- `scripts/verify-electron-packaging.mjs`
- `docs/deep-links.md`
- `scripts/protocol-handler-smoke-test.mjs`
- `docs/task-checkpoints/task-369-actual-desktop-protocol-handler-wiring.md`
- `package.json`

## Commands run

```bash
npm run protocol-handler:smoke
npm run typecheck
npm run qa:smoke
npm run build
```

## How to test manually

1. Run `npm run electron:dev`.
2. Confirm the desktop app opens normally.
3. Use renderer simulation for development if needed: `deepLinkService.simulateDeepLink("picom://settings")`.
4. Build/package later and open `picom://settings` from the OS to verify native protocol registration.
5. Try an invalid link such as `picom://settings?token=test`; it should be ignored and must not crash the app.

## Notes

Protocol handling only routes safe app navigation. It does not execute shell commands, open files, or bypass Supabase/backend permissions.
