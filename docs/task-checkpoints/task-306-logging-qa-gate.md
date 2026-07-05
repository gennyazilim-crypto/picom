# Task 306 Checkpoint: Logging QA Gate

## Scope

Added a concrete smoke test for the central logging and redaction layer without changing the desktop UI or adding product features.

## Changed files

- `package.json`
- `scripts/qa-smoke-gate.mjs`
- `scripts/logging-service-smoke-test.mjs`
- `docs/logging-qa-gate.md`
- `docs/task-checkpoints/task-306-logging-qa-gate.md`

## Validation

- `npm run logs:smoke`
- `npm run qa:smoke`
- `npm run typecheck`
- `npm run build`

## Result

The QA gate now checks that Picom's logging service keeps a bounded log buffer, exposes diagnostics helpers, cleans up listeners, and redacts sensitive values before logs can be exported.
