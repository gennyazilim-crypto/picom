# Task 087 - Message hover actions

Picom now has a dedicated `MessageHoverActions` component.

## Runtime path

- `src/components/MessageHoverActions.tsx`
- Used by `src/components/MessageItem.tsx`

## Behavior

- Renders compact reply, react, and more placeholder actions.
- Uses the approved app icon system.
- Keeps actions visible on message hover.
- Also reveals the action bar when keyboard focus is inside the message item.
- Uses shared focus ring tokens.

## Manual verification

1. Start the app.
2. Hover a message and confirm reply/react/more actions appear.
3. Tab to a message avatar/action area and confirm hover actions can remain visible with focus.
4. Toggle light/dark mode and confirm action buttons remain readable.
