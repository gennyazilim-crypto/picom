# Task 338 - Bot System Foundation

## Status

Completed.

## Scope

- Added documentation-first bot system foundation.
- Added smoke test to ensure the foundation stays post-MVP and does not add runtime bot features.

## Changed files

- `docs/bot-system-foundation.md`
- `scripts/bot-system-foundation-smoke-test.mjs`
- `package.json`
- `docs/task-checkpoints/task-338-bot-system-foundation.md`

## Verification

- `npm run bots:foundation:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## Manual test

1. Review `docs/bot-system-foundation.md`.
2. Confirm bot runtime, marketplace, token issuance, and arbitrary code execution are not enabled in the app.

## Notes

- Bot system remains post-MVP.
- Future implementation must be backend-enforced and permission-gated.