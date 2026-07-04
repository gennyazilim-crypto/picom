# Task 076 - ServerRail component

The ServerRail is the fixed left rail for Picom's desktop chat shell.

## Implemented behavior

- Fixed 72px rail below the title bar.
- Picom home/logo button.
- Community stack with active indicator and unread dot placeholder.
- Add community placeholder action.
- Discover communities placeholder action.
- Settings button pinned to the bottom.
- Right-click community context menu handoff.
- Token-based active text color.

## Manual verification

1. Start the app.
2. Click each community icon and confirm the active rail indicator moves.
3. Click the Picom home, add, and discover buttons and confirm placeholder toasts appear.
4. Right-click a community icon and confirm the desktop context menu opens.
5. Confirm the rail stays fixed while the chat scrolls.
6. Toggle light/dark mode and confirm the rail remains readable.
