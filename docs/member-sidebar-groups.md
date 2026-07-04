# Task 094 - MemberSidebar groups

Picom now has a dedicated `MemberGroup` component for grouped member rendering.

## Runtime path

- `src/components/MemberGroup.tsx`
- Used by `src/components/MemberSidebar.tsx`

## Groups

- Admins
- Moderators
- Participants
- Offline

## Behavior

- Group headers show member counts.
- Member rows preserve avatar, status dot, display name, status text, and role badge.
- Member click opens the profile popover.
- Member right-click opens the context menu placeholder.
- Search filtering remains local and applies before grouping.

## Manual verification

1. Start the app.
2. Confirm all member groups render in the right sidebar.
3. Search for a member and confirm groups update.
4. Click a member and confirm the profile popover opens.
5. Right-click a member and confirm the context menu opens.
