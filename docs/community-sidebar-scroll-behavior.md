# Task 082 - CommunitySidebar scroll behavior

The CommunitySidebar scroll behavior is reinforced for the desktop MVP layout.

## Behavior

- Community header stays fixed at the top.
- UserMiniCard stays pinned at the bottom.
- Only the channel list scrolls.
- Scrollbar gutter is stable to avoid layout jitter.
- Overscroll is contained inside the sidebar.
- Channel and category rows remain width-safe.

## Manual verification

1. Start the app.
2. Scroll the CommunitySidebar channel list.
3. Confirm the CommunityHeader remains fixed.
4. Confirm the UserMiniCard remains pinned at the bottom.
5. Confirm the main app does not horizontally scroll.
6. Toggle light/dark mode and confirm scrollbars remain subtle.
