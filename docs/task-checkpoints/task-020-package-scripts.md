# Task 020 Checkpoint

Task: Configure package scripts for electron:dev and build

## Completed

- Made `npm run dev` launch Electron desktop development mode.
- Added `renderer:dev` for Vite-only renderer development.
- Kept `web:dev` as an explicit Vite-only alias.
- Kept `electron:dev` as the Electron + Vite dev flow.
- Updated `build` to run renderer typecheck, Electron TypeScript build, and Vite production build.

## Runtime changes

Package scripts only. UI runtime code was not changed.

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

If port `5173` is busy, close the existing dev server first.