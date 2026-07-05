# Task 336 - Message Moderation Filters Placeholder

## Status

Completed.

## Scope

- Added local moderation filter service.
- Added owner/admin/moderator moderation filter UI.
- Added send-message preflight check for blocked words and mention limits.
- Added documentation and a smoke test.

## Changed files

- `src/services/messageModerationFilterService.ts`
- `src/components/MessageModerationFiltersPanel.tsx`
- `src/components/CommunitySidebar.tsx`
- `src/App.tsx`
- `src/styles.css`
- `scripts/message-moderation-filters-smoke-test.mjs`
- `package.json`
- `docs/message-moderation-filters-placeholder.md`
- `docs/task-checkpoints/task-336-message-moderation-filters-placeholder.md`

## Verification

- `npm run moderation:filters:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## Manual test

1. Start Picom in Electron dev mode.
2. Open a mock owner/admin/moderator community.
3. Add a blocked word in Moderation filters.
4. Try sending a message containing that word.
5. Confirm the message is blocked and the UI remains stable.

## Notes

- This is local placeholder behavior only.
- Backend/Supabase enforcement remains future work.