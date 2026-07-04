# Task 155 Checkpoint: Create message delete mutation

## Completed

- Added `messageDeleteMutation` helper.
- Added `DeletedMessageSummary` DTO.
- Added `messageService.deleteMessage()`.
- Added validation for message id.
- Used soft-delete behavior for Supabase by setting `deleted_at`.
- Kept UI unchanged for MVP stability.

## Changed files

- `src/services/messageDeleteMutation.ts`
- `src/services/messageService.ts`
- `docs/message-delete-mutation.md`
- `docs/task-checkpoints/task-155-message-delete-mutation.md`

## Verification

Run:

```bash
npm run typecheck
npm run build
```

Manual verification will be possible once message context menu deletion is wired to `messageService.deleteMessage()`.