# Task 081 - UserMiniCard

Picom now has a dedicated `UserMiniCard` component for the pinned current-user area at the bottom of the CommunitySidebar.

## Runtime path

- `src/components/UserMiniCard.tsx`
- Used by `src/components/CommunitySidebar.tsx`

## Behavior

- Shows the current user's avatar with avatarpack fallback support.
- Shows display name and status text.
- Provides mute, deafen, and settings placeholder buttons.
- Opens the existing settings modal from the main user area and settings button.
- Preserves the fixed bottom position through the existing sidebar grid layout.

## Manual verification

1. Start the app.
2. Confirm the current user card stays pinned at the bottom of the CommunitySidebar.
3. Click the user name area and confirm Settings opens.
4. Click the settings icon and confirm Settings opens.
5. Confirm mute/deafen icon buttons remain visible and accessible.
