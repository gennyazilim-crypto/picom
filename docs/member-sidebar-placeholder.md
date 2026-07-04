# MemberSidebar placeholder

Task 044 extracts the MVP MemberSidebar into a dedicated desktop component.

## Behavior

- The sidebar remains fixed at 280px.
- Search filters members locally.
- Admin, moderator, participant, and offline groups remain visible.
- Member rows still open the profile popover through App-level callbacks.
- Right-click member context menu wiring remains intact.

## Manual verification

- Launch Picom.
- Toggle members from the ChatHeader.
- Search for a member.
- Click a member to open the profile popover.
- Right-click a member to open the context menu placeholder.