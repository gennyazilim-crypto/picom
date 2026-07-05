# Task 350 Checkpoint - Composer Permission States

## Status

Completed as a small MVP-safe UI foundation.

## Changed files

- `src/components/ChatMain.tsx`
- `src/components/MessageComposer.tsx`
- `src/styles.css`
- `docs/composer-permission-states.md`
- `scripts/composer-permission-states-smoke-test.mjs`
- `docs/task-checkpoints/task-350-composer-permission-states.md`
- `package.json`

## What changed

- `ChatMain` now derives a simple role-level based disabled reason for the composer.
- `MessageComposer` shows an inline read-only hint and disables send/attach/emoji/GIF/paste/drop when a disabled reason exists.
- Added token-based CSS for the disabled composer state.
- Added documentation and smoke verification.

## Commands run

- `npm run composer:permissions:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## How to test manually

1. Start Picom with the default mock owner user.
2. Confirm message sending still works normally.
3. For local QA only, temporarily make the current mock user a `guest`.
4. Confirm the composer shows a clear permission hint and buttons are disabled.
5. Restore the mock user role after QA.

## Notes

- This is a frontend UX improvement only.
- Supabase RLS/backend permissions remain the enforcement layer.
