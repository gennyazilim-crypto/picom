# UI Layout Fixes: DM, Voice, Feed Rail

## Completed

- Added a Coolicons/AppIcon Direct Messages entry to ServerRail and connected it to the existing DM view.
- Removed the role badge from CommunityHeader without changing role-aware menu behavior.
- Rebalanced UserMiniCard text and compact controls inside the existing 260px sidebar.
- Made VoiceRoomView fill ChatMain and use a balanced two-column desktop grid with a desktop-width stack fallback.
- Reduced story cards to compact 112x164 desktop cards with smaller internal typography and avatar treatment.
- Moved Mention Feed scrolling to MentionFeedMain so stories and tabs scroll away normally.
- Kept Connected Voice sticky inside FeedCompanionRail, aligned with the first mention card above friends and events.
- Preserved existing medium-desktop rail collapse and page-level overflow safety.

## Verification

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

Manual verification covers ServerRail navigation, community role menus, VoiceRoomView width, UserMiniCard truncation, story scrolling, sticky voice controls, companion content, desktop overflow, and both themes.
