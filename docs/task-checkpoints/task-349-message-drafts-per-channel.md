# Task 349 Checkpoint - Message Drafts Per Channel

## Status

Completed as a local MVP-safe foundation.

## Changed files

- `src/services/messageDraftService.ts`
- `src/components/MessageComposer.tsx`
- `docs/message-drafts-per-channel.md`
- `scripts/message-drafts-smoke-test.mjs`
- `docs/task-checkpoints/task-349-message-drafts-per-channel.md`
- `package.json`

## What changed

- Added a small `messageDraftService` for local per-community/per-channel text drafts.
- `MessageComposer` now restores drafts on channel switch, saves text while typing, clears drafts after successful send, and revokes attachment previews when switching channels.
- Added documentation and a smoke test for draft safety boundaries.

## Commands run

- `npm run drafts:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## How to test manually

1. Type a draft in one text channel without sending.
2. Switch to another channel and type a different draft.
3. Return to the first channel and confirm the first draft returns.
4. Send the message and confirm that channel draft clears.
5. Attach an image, switch channels, and confirm stale attachment previews are not restored.

## Notes

- Drafts store text only.
- Attachment files/object URLs are not persisted.
- Draft storage is local only and does not require Supabase.
