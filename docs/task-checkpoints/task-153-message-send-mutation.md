# Task 153 Checkpoint: Create message send mutation

## Completed

- Added `messageSendMutation` helper.
- Routed `messageService.sendMessage()` through the mutation helper.
- Preserved mock-mode message sending.
- Prepared Supabase-mode message insert through a dedicated mutation boundary.
- Routed the existing composer send handler through `messageService.sendMessage()`.
- Allowed local state append to use service-confirmed id and timestamp.

## Changed files

- `src/App.tsx`
- `src/services/messageSendMutation.ts`
- `src/services/messageService.ts`
- `src/state/useLocalMessageState.ts`
- `docs/message-send-mutation.md`
- `docs/task-checkpoints/task-153-message-send-mutation.md`

## Verification

Run:

```bash
npm run typecheck
npm run build
```

Manual test: send a local message in mock mode and confirm it appears once in the active channel.