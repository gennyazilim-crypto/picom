# Task 078 - CommunityHeader

Picom now has a dedicated `CommunityHeader` component for the top of the CommunitySidebar.

## Runtime path

- `src/components/CommunityHeader.tsx`
- Used by `src/components/CommunitySidebar.tsx`

## Behavior

- Shows community mark using the community accent color.
- Shows community name and desktop community subtitle.
- Provides a community menu button wired to the existing settings placeholder action.
- Reuses the existing `community-header` styling so the desktop layout and spacing remain unchanged.

## Manual verification

1. Start the app.
2. Switch communities from the ServerRail.
3. Confirm the sidebar header name and accent mark update.
4. Click the community menu chevron and confirm the existing settings placeholder opens.
5. Toggle light/dark mode and confirm the header stays readable.
