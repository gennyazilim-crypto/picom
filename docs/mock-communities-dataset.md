# mockCommunities dataset

Task 062 records the MVP mock community dataset used by Picom while backend integration is still being prepared.

## Runtime source

- Dataset file: `src/data/mockCommunities.ts`
- Domain types: `src/types/community.ts`
- Current user id: `currentUserId`
- Main export: `mockCommunities`

## Dataset shape

The MVP dataset includes:

- 5 desktop communities
- Fixed category groups matching the reference-style community sidebar:
  - Information
  - Channels
  - Music & Bots
  - General
  - Work Space
- Text channels and voice placeholder channels
- Owner, Admin, Moderator, Member, Guest role placeholders
- Online, idle, do-not-disturb, and offline member states
- Local message history for multiple channels
- Generated image attachments for 1, 2, 3, and 4-image grid states
- Reaction placeholders

## Design constraints

- No Discord branding, logos, copied assets, or exact Discord colors.
- Community colors use the Picom palette.
- Mock image attachments are generated SVG placeholders.
- Member avatars are resolved through the avatarpack fallback pipeline when no `avatarUrl` exists.

## Manual verification

- Launch Picom with `npm run dev`.
- Switch through each community in the ServerRail.
- Switch through text and voice channels.
- Confirm message history, image attachment grids, members, and role badges render without a backend.