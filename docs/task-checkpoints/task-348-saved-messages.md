# Task 348 Checkpoint - Saved Messages

## Status

Completed as a post-MVP documentation-first foundation.

## Changed files

- `docs/saved-messages-foundation.md`
- `scripts/saved-messages-foundation-smoke-test.mjs`
- `docs/task-checkpoints/task-348-saved-messages.md`
- `package.json`

## What changed

- Documented future saved messages data model, Supabase/RLS expectations, service methods, desktop UI entry points, jump behavior, privacy/logging rules, and feature flag behavior.
- Added a smoke test to verify the foundation doc remains explicit.
- Runtime layout and message context menus were intentionally left unchanged.

## Commands run

- `npm run saved:messages:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## How to test manually

1. Start Picom.
2. Confirm no Saved Messages view appears in the current MVP UI.
3. Confirm message context menus behave as before.
4. Confirm the 4-column desktop layout remains stable with no horizontal overflow.

## Notes

- This task does not add Supabase migrations or runtime saved-message actions.
- Saved Messages remain post-MVP until explicitly prioritized.
