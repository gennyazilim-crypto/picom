# Local message state

Task 069 creates a focused local message state hook for MVP mock mode.

## Runtime source

- `src/state/useLocalMessageState.ts`

## Responsibilities

- Own local community/message state.
- Append locally sent messages.
- Stamp local messages with channel, author, created time, attachments, and `localStatus`.
- Keep message sending backend-free for MVP mock mode.

## Future backend path

When Supabase messaging is wired, this hook can become the optimistic local layer while a message service confirms server writes.