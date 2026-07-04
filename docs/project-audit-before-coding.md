# Read-only Project Audit Before Coding

This audit records the current Picom project state before additional implementation work continues.

## Audit date

2026-07-04

## Current project type

- Current runtime baseline: Vite + React + TypeScript renderer.
- Target runtime direction: Electron desktop app for Windows, Linux, and macOS.
- Electron shell: not present yet.
- Supabase integration: not present yet.
- LiveKit integration: not present yet.

## Root structure observed

- `assets/`
- `docs/`
- `node_modules/`
- `src/`
- `.gitignore`
- `index.html`
- `package-lock.json`
- `package.json`
- `README.md`
- `THIRD_PARTY_NOTICES.md`
- `tsconfig.json`
- `vite.config.ts`

## Source structure observed

- `src/App.tsx`
- `src/main.tsx`
- `src/styles.css`
- `src/vite-env.d.ts`
- `src/components/AppIcon.tsx`
- `src/data/`
- `src/services/`
- `src/types/`

## Service abstractions observed

- `clipboardService.ts`
- `fileService.ts`
- `notificationService.ts`
- `settingsService.ts`
- `shortcutService.ts`
- `trayService.ts`
- `windowService.ts`

These are useful for the future Electron bridge direction because native behavior can stay behind typed services instead of being called directly from React components.

## Scripts known from current package setup

- `dev`: Vite dev server
- `build`: TypeScript check plus Vite production build
- `typecheck`: TypeScript check only
- `preview`: Vite preview server

## Verification result

`npm run typecheck` passed during this audit.

## Key risks before coding continues

- Electron shell is still pending, so Electron dev/build verification cannot be completed yet.
- Supabase schema, RLS policies, and client setup are still pending.
- LiveKit token flow and voice UI implementation are still pending.
- `src/App.tsx` appears to hold a large amount of UI logic; future refactors should be task-scoped and careful.
- Advanced roadmap work should not be added before the new task pack reaches those phases.

## Safe next implementation direction

Proceed through the new `electron_supabase_livekit_all_old_new_tasks_001_473` task pack in order. Keep each task isolated, tested with the smallest relevant check, and committed before moving on.