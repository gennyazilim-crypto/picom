# Task Checkpoint: Followed People Stories Header

## Scope

- Added a Followed People Stories header above the Mention Feed tabs.
- Removed the old text-heavy Mention Feed header copy and refresh placeholder.
- Kept Feed / Takip Ettigin Kisiler tabs, mention cards, companion rail, and right panel stable.
- Used mock/local data only.
- Did not connect Supabase or LiveKit.
- Did not add mobile UI.

## Implemented

- `FollowedPeopleStoriesHeader`
- `StoryCard`
- `StoryCardGrid`
- `StoryViewerModal`
- `StoryProgressBar`
- `StoryViewerControls`
- `FollowedUserStory` story types
- `mockFollowedUserStories` with 12 followed-user stories
- Local seen/unseen state
- Story viewer close, previous, next, Escape, ArrowLeft, and ArrowRight controls
- Open in channel for stories with community/channel context

## Validation

- `npm run stories:header:smoke`
- `npm run feed:companion:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Notes

- Story artwork uses Picom-safe CSS gradients and abstract shapes.
- Story cards are desktop-only and horizontally scroll inside their own grid.
- No external copyrighted assets were added.
