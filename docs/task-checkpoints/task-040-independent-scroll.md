# Task 040 checkpoint - Independent scroll containers

## Completed

- Added scoped scrollbar behavior for channel, message, member, and command lists.
- Added overscroll containment so scroll gestures stay inside the intended panel.
- Confirmed the desktop frame remains fixed and composer remains pinned by layout.

## Verification

- Run `npm run typecheck`.
- Run `npm run build`.
- Manually scroll channel list, message list, and member list independently.