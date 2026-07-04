# Task 080 - ChannelItem component

Picom now has a dedicated `ChannelItem` component for individual sidebar channels.

## Runtime path

- `src/components/ChannelItem.tsx`
- Used by `src/components/ChannelCategory.tsx`

## Behavior

- Renders text and voice channel icons from the Coolicons-based app icon system.
- Shows active channel state.
- Shows private channel lock, unread indicator, and mention badge placeholders.
- Preserves channel click and right-click context menu behavior.
- Adds `aria-current` for the active channel.

## Manual verification

1. Start the app.
2. Click several text channels and confirm active state updates.
3. Click voice placeholder channels and confirm channel switching still works.
4. Right-click a channel and confirm the desktop context menu opens.
5. Confirm private/unread/mention indicators remain visible where present.
