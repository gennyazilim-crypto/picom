# Task 345 Checkpoint - Threads Placeholder

## Status

Completed as a post-MVP documentation-only placeholder.

## Changed files

- `docs/threads-placeholder.md`
- `scripts/threads-placeholder-smoke-test.mjs`
- `docs/task-checkpoints/task-345-threads-placeholder.md`
- `package.json`

## What changed

- Documented future thread data model, Supabase/RLS access rules, service methods, desktop UI placeholder, realtime events, performance notes, and security boundaries.
- Added a smoke test that verifies the placeholder is explicit.
- Runtime thread UI and message list behavior were intentionally left unchanged.

## Commands run

- `npm run threads:placeholder:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## How to test manually

1. Start Picom.
2. Confirm no ThreadPanel appears in the MVP UI.
3. Confirm existing MessageList, MessageComposer, and MemberSidebar behavior remains stable.
4. Review `docs/threads-placeholder.md` before adding any future thread runtime code.

## Notes

- This task avoids adding thread panel imports or runtime UI to prevent startup regressions.
- Threads remain post-MVP until explicitly prioritized.
