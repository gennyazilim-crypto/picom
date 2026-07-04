# Mock channels and categories

Task 064 separates mock channel/category generation from the community dataset.

## Runtime source

- `src/data/mockChannels.ts` owns the MVP channel/category template.
- `src/data/mockCommunities.ts` calls `createMockCategories()` for each mock community.

## Included categories

- Information
- Channels
- Music & Bots
- General
- Work Space

## Included channel states

- Text channels
- Voice placeholder channels
- Private channel placeholder
- Unread dot placeholder
- Mention badge placeholder
- Category/channel positions for future ordering work

## Verification

Launch Picom and confirm category collapse, channel switching, private lock icon, unread dot, mention badge, and voice placeholder channels still work without a backend.