# Task 151 Checkpoint: Create message service

## Completed

- Added typed `messageService` foundation.
- Added `SendMessageInput`, `MessageSummary`, and service error codes.
- Added mock-mode send behavior.
- Added Supabase-mode insert behavior for `public.messages`.
- Added row-to-DTO mapper and message select constant.

## Changed files

- `src/services/messageService.ts`
- `docs/message-service.md`
- `docs/task-checkpoints/task-151-message-service.md`

## Verification

Run:

```bash
npm run typecheck
npm run build
```

Manual verification for a later flow task: route `MessageComposer` through `messageService.sendMessage()` and confirm mock mode still sends instantly.