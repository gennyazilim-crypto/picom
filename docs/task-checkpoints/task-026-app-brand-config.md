# Task 026 Checkpoint

Task: Add app config and brand config

## Completed

- Added Electron app config in `electron/appConfig.cts`.
- Added renderer app config in `src/config/appConfig.ts`.
- Added Picom brand config in `src/config/brandConfig.ts`.
- Updated Electron main process to use centralized app config for app id, name, window sizes, and background color.
- Preserved Picom palette and Coolicons attribution metadata.

## Verification

Commands run:

```powershell
npm run electron:build
npm run typecheck
npm run build
```

All passed.

Manual Electron dev mode:

```powershell
npm run dev
```