# Task 352 Checkpoint - Message Search Result Jump

## Status

Completed as local Command Palette jump/highlight behavior.

## Changed files

- `src/App.tsx`
- `src/components/ChatMain.tsx`
- `src/components/MessageList.tsx`
- `src/styles.css`
- `docs/message-search-result-jump.md`
- `scripts/message-search-jump-smoke-test.mjs`
- `docs/task-checkpoints/task-352-message-search-result-jump.md`
- `package.json`

## What changed

- Message results in the Command Palette now use `jumpToMessage()` instead of the previous highlight placeholder toast.
- The app switches community/channel, clears unread state, scrolls the target message into view, and applies a brief highlight animation.
- Added docs and smoke verification.

## Commands run

- `npm run message:search-jump:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## How to test manually

1. Open Command Palette from the titlebar search.
2. Search for visible message text.
3. Select a result under `Messages`.
4. Confirm the app opens the correct community/channel.
5. Confirm the target message scrolls into view and highlights briefly.

## Notes

- Supabase search/RLS must remain the source of truth before API-backed search returns private message results.
