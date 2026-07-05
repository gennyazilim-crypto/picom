# Task 340 Checkpoint - Slash Commands Placeholder

## Status

Completed as a post-MVP placeholder.

## Changed files

- `docs/slash-commands-placeholder.md`
- `scripts/slash-commands-placeholder-smoke-test.mjs`
- `docs/task-checkpoints/task-340-slash-commands-placeholder.md`
- `package.json`

## What changed

- Documented the future slash command UX, command examples, keyboard behavior, security boundaries, and feature flag behavior.
- Added a lightweight smoke test to ensure the placeholder stays explicit and safe.
- Runtime composer behavior was intentionally left unchanged.

## Commands run

- `npm run slash:commands:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## How to test manually

1. Start Picom in desktop dev mode.
2. Send a normal message to confirm composer behavior is unchanged.
3. Type `/hello` and confirm it behaves as normal message text today.
4. Confirm no slash command suggestion popover appears until the feature is intentionally enabled later.

## Notes

- This task does not execute arbitrary command code.
- Backend permissions remain required for any future permission-sensitive command.
