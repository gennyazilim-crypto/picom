# Task 309 Checkpoint: QA Output Encoding

## Scope

Fixed the QA smoke gate completion line so it renders correctly in Windows terminals, then added a smoke test that prevents mojibake characters from reappearing in QA scripts.

## Changed files

- `package.json`
- `scripts/qa-smoke-gate.mjs`
- `scripts/qa-output-smoke-test.mjs`
- `docs/qa-output-encoding.md`
- `docs/task-checkpoints/task-309-qa-output-encoding.md`

## Validation

- `npm run qa:output:smoke`
- `npm run qa:smoke`
- `npm run typecheck`
- `npm run build`

## Result

QA output remains readable and stable across Windows, Linux, and macOS developer terminals.
