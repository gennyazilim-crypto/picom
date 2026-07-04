# Task 086 - MessageItem

Picom now has a dedicated `MessageItem` component for individual chat messages.

## Runtime path

- `src/components/MessageItem.tsx`
- Used by `src/components/MessageList.tsx`

## Behavior

- Renders author avatar, display name, role badge, timestamp, and body text.
- Preserves attachment preview grid for current MVP rendering.
- Preserves reaction row.
- Preserves hover actions: reply, react, more.
- Preserves message right-click context menu and profile popover opening.

## Manual verification

1. Start the app.
2. Open a text channel with messages.
3. Hover a message and confirm hover actions appear.
4. Right-click a message and confirm the context menu opens.
5. Click a message avatar and confirm the profile popover opens.
6. Click an attachment and confirm image preview opens.
