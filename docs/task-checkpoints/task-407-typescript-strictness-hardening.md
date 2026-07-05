# Task 407: TypeScript strictness hardening

## Scope
- Added a small safe TypeScript compiler hardening option.
- Documented current strictness and deferred stricter options.
- No runtime UI, Electron behavior, Supabase behavior, or LiveKit behavior changed.

## Completed
- Enabled `noFallthroughCasesInSwitch` in renderer, Electron, and shared TypeScript configs.
- Created `docs/typescript-strictness.md`.
- Documented why riskier options are deferred.

## Verification
- Run renderer typecheck.
- Run Electron TypeScript build.
- Run shared package typecheck.

## Manual test steps
1. Run `npm run typecheck`.
2. Run `npm run electron:build`.
3. Run `npm run shared:types:check`.
4. Review `docs/typescript-strictness.md` for deferred strictness decisions.
