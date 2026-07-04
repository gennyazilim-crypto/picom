# Task 162 Checkpoint: Ensure mock mode still works

## Completed

- Added `scripts/mock-mode-smoke-test.mjs`.
- Added `npm run mock:smoke`.
- Documented mock mode verification steps.

## Changed files

- `package.json`
- `scripts/mock-mode-smoke-test.mjs`
- `docs/mock-mode-smoke-test.md`
- `docs/task-checkpoints/task-162-mock-mode-smoke-test.md`

## Verification

Run:

```bash
npm run mock:smoke
npm run typecheck
npm run build
```

Manual test: start the app in mock mode and verify community switching, channel switching, message send, and member search.