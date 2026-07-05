# Package Boundary Review

Picom currently uses a single-package repository. A full monorepo migration is intentionally deferred because moving files into `apps/desktop`, `apps/server`, or `packages/*` would risk breaking the active Electron/Vite/Supabase workflow.

## Current structure

- `src/`: React + TypeScript renderer, UI components, hooks, state, services, mock data, types, and styles.
- `electron/`: Electron main/preload source.
- `supabase/`: Supabase migrations, seed files, tests, and Edge Functions.
- `scripts/`: QA, smoke, operational, and documentation verification scripts.
- `docs/`: product, architecture, operations, security, release, and task checkpoint documentation.
- `assets/` and `public/`: app/logo/static assets.
- `dist/`, `dist-electron/`, and `release/`: generated build/package outputs.
- root config: `package.json`, TypeScript configs, Vite config, electron-builder config, env examples, license/notices.

## Current boundaries

- React components should not call Electron, Supabase, LiveKit, or native APIs directly.
- Renderer runtime integrations should go through services/hooks under `src/services` and `src/hooks`.
- Electron native APIs should stay behind `electron/preload` and service abstractions.
- Supabase privileged logic should live in Edge Functions or trusted backend code, never the renderer.
- Documentation and generated outputs should not be imported by runtime code.

## Why not migrate now

- The repo already builds and packages as a single Electron app.
- `package.json` scripts assume root-level Vite/Electron paths.
- Supabase CLI workflows assume root-level `supabase/`.
- Large path moves would create noisy diffs and increase risk while MVP stability work is still active.

## Future monorepo target

Recommended long-term structure:

```text
apps/
  desktop/
    src/
    electron/
    public/
packages/
  shared/
    src/types/
    src/dto/
    src/events/
    src/permissions/
  config/
    src/
docs/
scripts/
supabase/
assets/
```

## Migration triggers

Consider moving to a monorepo only when at least one is true:

- Shared DTOs are imported by both renderer and Edge Functions.
- More than one app target exists.
- Backend/server code grows beyond Supabase Edge Functions.
- CI needs independent package checks.
- Build times or dependency boundaries become hard to manage.

## Safe cleanup allowed now

- Keep docs/checkpoints organized.
- Keep scripts named by task or domain.
- Keep generated build outputs out of runtime imports.
- Add shared types in place first; only move later if build tooling supports it.

## Risky cleanup deferred

- Moving `src/` into `apps/desktop/`.
- Moving `electron/` into `apps/desktop/electron/`.
- Moving Supabase Edge Function shared code into packages without import-map testing.
- Introducing workspaces before package publishing/build scripts are designed.

## Decision

Keep the current single-package layout for MVP. Document the intended monorepo shape and defer structural migration until after core desktop, Supabase, LiveKit, packaging, and QA flows are stable.
