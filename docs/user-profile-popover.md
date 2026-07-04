# Task 096 - UserProfilePopover

Picom now has a dedicated `UserProfilePopover` component.

## Runtime path

- `src/components/UserProfilePopover.tsx`
- Used by `src/App.tsx`

## Behavior

- Opens from member rows and message avatars.
- Shows cover gradient, avatar, display name, username, status, role badge, bio, and placeholder actions.
- Closes on Escape or outside pointer down.
- Keeps the popover inside the current window bounds.
- Uses avatarpack fallback through `MemberAvatar`.

## Manual verification

1. Start the app.
2. Click a member row in MemberSidebar.
3. Click a message avatar.
4. Confirm the popover opens and stays inside the viewport.
5. Close with Escape and outside click.
6. Toggle light/dark mode and confirm the popover remains readable.
