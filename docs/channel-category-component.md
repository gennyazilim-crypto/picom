# Task 079 - ChannelCategory collapsible component

Picom now has a dedicated `ChannelCategory` component for collapsible sidebar channel groups.

## Runtime path

- `src/components/ChannelCategory.tsx`
- Used by `src/components/CommunitySidebar.tsx`

## Behavior

- Renders category header with collapse/expand state.
- Shows channel count.
- Preserves active channel state.
- Preserves unread dot, mention badge, private channel icon, and voice/text icons.
- Keeps right-click context menu handoff for channel items.

## Manual verification

1. Open the app.
2. Collapse and expand each category in the CommunitySidebar.
3. Click channels inside expanded categories and confirm active state updates.
4. Right-click a channel and confirm the context menu opens.
5. Toggle light/dark mode and confirm category rows remain readable.
