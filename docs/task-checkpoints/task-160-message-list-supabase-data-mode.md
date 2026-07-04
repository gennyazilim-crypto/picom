# Task 160 Checkpoint: Connect MessageList to Supabase data mode

## Completed

- Added local state replacement for channel messages.
- Loaded Supabase messages for the active community/channel.
- Routed data through `messageService.listMessages()`.
- Kept mock mode unchanged.
- Documented RLS and environment requirements.

## Changed files

- `src/App.tsx`
- `src/state/useLocalMessageState.ts`
- `docs/message-list-supabase-data-mode.md`
- `docs/task-checkpoints/task-160-message-list-supabase-data-mode.md`

## Verification

Run:

```bash
npm run typecheck
npm run build
```

Manual test: in Supabase mode, sign in and switch text channels. MessageList should show messages returned by Supabase for the active channel.