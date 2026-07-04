# Task 093 - Local message send and auto-scroll

Picom local message sending and message list auto-scroll are reinforced for MVP mock mode.

## Runtime paths

- `src/state/useLocalMessageState.ts`
- `src/components/MessageList.tsx`

## Behavior

- Local sends append a typed `Message` to the active community/channel.
- Local message ids now use `crypto.randomUUID()` when available, with a safe fallback.
- MessageList scrolls after the last message id changes, which covers sends and channel changes more reliably than only checking list length.
- Composer remains pinned because scrolling is contained inside MessageList.

## Manual verification

1. Start the app.
2. Send one local message and confirm it appears at the bottom.
3. Send multiple messages quickly and confirm no duplicate React key behavior appears.
4. Switch channels and confirm the message list scroll position is stable for the active channel.
5. Confirm the composer remains pinned.
