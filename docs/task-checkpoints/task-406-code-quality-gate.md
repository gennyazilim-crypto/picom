# Task 406: Code quality gate

## Scope
- Added dependency-free npm quality gate scripts and documentation.
- No runtime UI, Electron shell behavior, Supabase backend behavior, or LiveKit behavior changed.

## Completed
- Added `npm run quality:fast` for `qa:smoke` + `typecheck`.
- Added `npm run quality:gate` for `qa:smoke` + `typecheck` + `build`.
- Updated README quality gate instructions.
- Created `docs/code-quality-gate.md` with command usage, included checks, current exclusions, quality rules, and failure policy.

## Verification
- Run `npm run quality:fast` after this task.
- Confirmed the docs describe the full gate and no heavy dependency was added.

## Manual test steps
1. Run `npm run quality:fast` for scoped checkpoints.
2. Run `npm run quality:gate` before release/build-sensitive checkpoints.
3. If either command fails, stop feature work and fix the blocker before committing.
