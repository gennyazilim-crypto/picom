# Task 097 - DesktopContextMenu

Picom now has a dedicated `DesktopContextMenu` component.

## Runtime path

- `src/components/DesktopContextMenu.tsx`
- Used by `src/App.tsx`

## Behavior

- Opens at the right-click pointer position.
- Clamps position so the menu stays inside the window.
- Closes on outside pointer down.
- Closes on Escape.
- Supports disabled and danger menu items.
- Executes item callbacks and closes after selection.

## Manual verification

1. Start the app.
2. Right-click a community icon.
3. Right-click a channel.
4. Right-click a message.
5. Right-click a member.
6. Confirm context menus stay inside the window and close on Escape/outside click.
