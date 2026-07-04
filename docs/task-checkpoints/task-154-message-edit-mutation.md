# Task 154 Checkpoint: Create message edit mutation

## Completed

- Added `messageEditMutation` helper.
- Added `EditedMessageSummary` DTO.
- Added `messageService.editMessage()`.
- Added validation for message id, non-empty body, and max body length.
- Kept UI unchanged for MVP stability.

## Changed files

- `src/services/messageEditMutation.ts`
- `src/services/messageService.ts`
- `docs/message-edit-mutation.md`
- `docs/task-checkpoints/task-154-message-edit-mutation.md`

## Verification

Run:

```bash
npm run typecheck
npm run build
```

Manual verification will be possible once an inline editor is wired to `messageService.editMessage()`.