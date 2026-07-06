# Task 442 checkpoint: First-run performance budget

## Status

Complete.

## Changed files

- `docs/performance-budget.md`
- `scripts/performance-budget-smoke-test.mjs`
- `package.json`
- `docs/task-checkpoints/task-442-first-run-performance-budget.md`

## Validation

- `npm run performance:budget:smoke`

## Notes

This task is documentation-first and does not change runtime behavior. The budget is scoped to the Windows/Linux/macOS Electron desktop app and explicitly keeps mobile UI out of scope.
