# Task 088 - Unread divider placeholder

Picom now has a dedicated `UnreadDivider` placeholder component.

## Runtime path

- `src/components/UnreadDivider.tsx`
- Used by `src/components/MessageList.tsx`

## Behavior

- Displays a compact separator for unread messages.
- Uses the existing `unread-divider` token-based styling.
- Adds separator semantics with `role="separator"`.
- Keeps the current placeholder placement in the middle of mock message lists.

## Manual verification

1. Start the app.
2. Open a text channel with multiple messages.
3. Confirm the unread divider appears between messages.
4. Toggle light/dark mode and confirm the divider remains readable.
