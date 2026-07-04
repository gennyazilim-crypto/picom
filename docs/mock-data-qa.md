# Task 074 - Mock data QA

## QA summary

The MVP mock data layer was reviewed for desktop UI coverage and deterministic behavior.

## Verified coverage

- Communities: 5
- Members: 12 per community, 60 total generated members
- Roles: Owner, Admin, Moderator, Member, Guest
- Channel categories: Information, Channels, Music & Bots, General, Work Space
- Channel types: text and voice placeholder
- Messages: 15 per community, 75 total generated messages
- Attachments: one-image, two-image, three-image, and four-image layouts exist
- Palette: Picom teal/aqua/orange/brown colors are used in community accents and mock images

## Fix made during QA

Mock message timestamps now use a fixed base timestamp instead of `Date.now()`. This keeps mock mode stable across reloads and prevents noisy UI changes while testing the desktop layout.

## Manual QA checklist

1. Start Picom in mock mode.
2. Switch through all five communities.
3. Open each category group and confirm text/voice channels render.
4. Switch to general/showcase/talk channels and confirm messages render.
5. Confirm image attachment layouts display without overflow.
6. Search members in the right sidebar.
7. Send a local message and confirm it appears in the active channel.
