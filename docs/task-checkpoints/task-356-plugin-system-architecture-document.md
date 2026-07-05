# Task 356 Checkpoint - Plugin System Architecture Document

## Status

Completed as a post-MVP architecture document.

## Changed files

- `docs/plugin-system.md`
- `scripts/plugin-system-architecture-smoke-test.mjs`
- `docs/task-checkpoints/task-356-plugin-system-architecture-document.md`
- `package.json`

## What changed

- Documented plugin goals, non-goals, security boundaries, allowed extension points, forbidden capabilities, permissions model, review/signing placeholder, bot-vs-plugin distinction, UI restrictions, sandboxing strategy, and risks.
- Added a smoke test to ensure the architecture document keeps explicit no-arbitrary-code boundaries.
- Runtime code was intentionally not changed.

## Commands run

- `npm run plugin-system:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## How to test manually

1. Review `docs/plugin-system.md`.
2. Confirm the document forbids arbitrary code execution, shell/filesystem access, unsafe tokens, and direct native IPC.
3. Start Picom and confirm no plugin UI or runtime appears.

## Notes

- No plugin loader or dynamic code path was added.
- Plugin system remains post-MVP.
