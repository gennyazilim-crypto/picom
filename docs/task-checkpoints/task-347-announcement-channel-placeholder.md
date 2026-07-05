# Task 347 Checkpoint - Announcement Channel Placeholder

## Status

Completed as a post-MVP documentation-only placeholder.

## Changed files

- `docs/announcement-channel-placeholder.md`
- `scripts/announcement-channel-placeholder-smoke-test.mjs`
- `docs/task-checkpoints/task-347-announcement-channel-placeholder.md`
- `package.json`

## What changed

- Documented future announcement channel fields, Supabase/RLS expectations, UI behavior, notification behavior, realtime behavior, and feature flag gating.
- Added a smoke test that verifies the announcement channel foundation remains explicit.
- Runtime channel switching and composer behavior were intentionally left unchanged.

## Commands run

- `npm run announcement:channel:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## How to test manually

1. Start Picom.
2. Confirm normal channel switching still works.
3. Confirm MessageComposer still sends in regular text channels.
4. Confirm no announcement channel UI appears until the feature is intentionally enabled later.

## Notes

- This task does not add Supabase migrations or runtime announcement channel logic.
- Announcement channels remain post-MVP.
