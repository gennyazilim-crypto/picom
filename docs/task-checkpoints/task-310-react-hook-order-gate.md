# Task 310 Checkpoint: React Hook Order Gate

## Scope

Added a focused smoke test that guards the main app startup/auth path against conditional hook-order regressions.

## Changed files

- `package.json`
- `scripts/qa-smoke-gate.mjs`
- `scripts/react-hook-order-smoke-test.mjs`
- `docs/react-hook-order-qa.md`
- `docs/task-checkpoints/task-310-react-hook-order-gate.md`

## Validation

- `npm run react:hooks:smoke`
- `npm run qa:smoke`
- `npm run typecheck`
- `npm run build`

## Result

The QA gate now catches the highest-risk hook-order startup regression before it reaches the Electron renderer.
