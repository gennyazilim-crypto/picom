# Message Send Mutation

Task 153 formalizes message sending as a mutation boundary.

## Runtime flow

1. `MessageComposer` submits text to the app-level send handler.
2. The handler generates a `clientMessageId`.
3. The handler calls `messageService.sendMessage()`.
4. Mock mode returns a local message summary immediately.
5. Supabase mode inserts into `public.messages` through the configured Supabase client.
6. The returned message summary is appended to local UI state.

## Why this shape

This keeps the MVP desktop UI fast while preparing for Supabase confirmation, realtime echo reconciliation, and future optimistic update states.

## Current limitations

- Attachments are still rendered locally with the composer payload.
- Realtime echo reconciliation is not implemented in this task.
- Failed Supabase sends show a toast and do not append a fake confirmed message.

## Manual verification

1. Start the app in mock mode.
2. Sign in.
3. Send a message in the active channel.
4. Confirm the message appears locally.
5. Confirm layout, pinned composer, and independent chat scroll still work.