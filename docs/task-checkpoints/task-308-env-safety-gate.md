# Task 308 Checkpoint: Environment Safety Gate

## Scope

Added a concrete QA smoke test that protects Picom's renderer environment configuration from accidental server-secret exposure.

## Changed files

- `package.json`
- `scripts/qa-smoke-gate.mjs`
- `scripts/env-safety-smoke-test.mjs`
- `docs/environment-qa-gate.md`
- `docs/task-checkpoints/task-308-env-safety-gate.md`

## Validation

- `npm run env:smoke`
- `npm run qa:smoke`
- `npm run typecheck`
- `npm run build`

## Result

The QA gate now checks renderer env examples, gitignore protection, safe defaults, and Vite-only app config access before the rest of the smoke tests run.
