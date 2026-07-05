# Task Checkpoint: Feed Companion Rail with Voice, Friends, and Events

## Scope

- Added a new Mention Feed companion rail that starts in the feed body beside the first mention card.
- Kept the existing Mention Feed header, tabs, cards, and right overview panel stable.
- Used mock/local data only.
- Did not connect Supabase or LiveKit.
- Did not add mobile UI.

## Implemented

- `FeedCompanionRail` with:
  - `VoiceMiniControlCard`
  - `FriendsStatusSection`
  - `FriendStatusRow`
  - `UpcomingEventsSection`
  - `UpcomingEventMiniCard`
- Mock voice state with mute, deafen, leave, and screen share placeholder actions.
- Expanded friend mock data with online, idle/busy, and offline states.
- Added upcoming event mock data.
- Added desktop body grid so the rail aligns with the first mention card.
- Added width behavior that hides the new companion rail first on medium desktop widths.

## Validation

- `npm run feed:companion:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Notes

- Voice controls are local UI state only.
- Event details remain a safe placeholder.
- Event community navigation uses existing community switching.
