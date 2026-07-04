# Task 085 - MessageList container

Picom now has a dedicated `MessageList` container for the independently scrolling chat messages area.

## Runtime path

- `src/components/MessageList.tsx`
- Used by `src/components/ChatMain.tsx`

## Behavior

- Owns the message scroll container.
- Auto-scrolls to bottom when the message count changes.
- Renders the empty message state.
- Preserves unread divider placeholder.
- Preserves message avatar/profile behavior, right-click context menu, reactions, and image attachments.
- Keeps the composer pinned outside the list.

## Manual verification

1. Start the app.
2. Switch to a text channel with messages.
3. Confirm the message list scrolls independently.
4. Send a local message and confirm the list scrolls to the bottom.
5. Open a profile from a message avatar.
6. Open an image attachment preview.
