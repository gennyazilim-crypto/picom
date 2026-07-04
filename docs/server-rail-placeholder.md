# ServerRail placeholder

Task 041 extracts the MVP ServerRail into a dedicated desktop component.

## Behavior

- The rail remains fixed at 72px.
- The Picom logo acts as the home placeholder.
- Community icons render from typed mock data.
- Active, unread, add community, discover, and settings placeholders remain visible.
- Right-click context menu wiring remains owned by the app shell.

## Manual verification

- Launch Picom.
- Click different community icons.
- Confirm active state moves and the rest of the shell updates.
- Right-click a community icon to confirm the placeholder context menu still opens.