# Task 346 Checkpoint - Forum Channel Placeholder

## Status

Completed as a post-MVP documentation-only placeholder.

## Changed files

- `docs/forum-channel-placeholder.md`
- `scripts/forum-channel-placeholder-smoke-test.mjs`
- `docs/task-checkpoints/task-346-forum-channel-placeholder.md`
- `package.json`

## What changed

- Documented future forum channel type, data model, Supabase/RLS expectations, UI placeholder, navigation behavior, and feature flag behavior.
- Added a smoke test that verifies the forum channel foundation remains explicit.
- Runtime channel switching and MessageList behavior were intentionally left unchanged.

## Commands run

- `npm run forum:channel:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## How to test manually

1. Start Picom.
2. Confirm existing text and voice channel switching still works.
3. Confirm no forum channel appears in the MVP sidebar.
4. Review `docs/forum-channel-placeholder.md` before adding future forum runtime code.

## Notes

- This task avoids extending active channel types until all render paths are ready.
- Forum channels remain post-MVP.
