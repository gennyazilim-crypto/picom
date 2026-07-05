# TypeScript strictness hardening

Picom already uses `strict: true` for the renderer, Electron main/preload build, and shared DTO package. Task 407 adds a small safe hardening step and documents stricter options that should be enabled only after focused cleanup.

## Current enabled strictness

Renderer `tsconfig.json`:

- `strict: true`
- `allowJs: false`
- `isolatedModules: true`
- `forceConsistentCasingInFileNames: true`
- `noFallthroughCasesInSwitch: true`

Electron `tsconfig.electron.json`:

- `strict: true`
- `forceConsistentCasingInFileNames: true`
- `noFallthroughCasesInSwitch: true`

Shared package `packages/shared/tsconfig.json`:

- `strict: true`
- `declaration: true`
- `emitDeclarationOnly: true`
- `forceConsistentCasingInFileNames: true`
- `noFallthroughCasesInSwitch: true`

## Why `noFallthroughCasesInSwitch`

This option catches accidental `switch` fallthrough without forcing a large refactor. It is useful for Picom because many future service layers will branch on status, permission, realtime, upload, notification, and error-code enums.

## Deferred options

These options are intentionally not enabled yet:

- `exactOptionalPropertyTypes`
- `noUncheckedIndexedAccess`
- `noImplicitReturns`
- `noUnusedLocals`
- `noUnusedParameters`

Reason:

- They can create wide churn across existing mock data, DTO placeholders, generated Supabase types, and desktop service abstractions.
- They should be enabled one at a time with dedicated cleanup tasks and focused validation.
- They should not be enabled during broad roadmap/documentation work without a clear budget for fixes.

## Hardening path

Recommended order:

1. Run `npm run typecheck`, `npm run electron:build`, and `npm run shared:types:check`.
2. Trial `noImplicitReturns` and fix real missing-return bugs.
3. Trial `noUncheckedIndexedAccess` in shared types first.
4. Trial `exactOptionalPropertyTypes` after DTO optional fields are reviewed.
5. Add eslint/format tooling only when the team is ready to enforce style automatically.

## Rules for future changes

- Avoid `any` unless isolated and explained.
- Prefer shared DTOs over frontend/backend duplicate shapes.
- Do not import backend-only database/internal secret fields into renderer DTOs.
- Keep Supabase service-role and LiveKit secrets out of renderer types and env files.
- Prefer discriminated unions for state machines such as realtime, upload, auth, and update status.
