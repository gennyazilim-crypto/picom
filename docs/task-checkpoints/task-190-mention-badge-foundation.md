# Task 190 Checkpoint - Mention Badge Foundation

## Completed

- Added mention utility helpers:
  - `normalizeMentionCount`
  - `formatMentionBadge`
  - `messageMentionsUser`
- Channel mention badges now use normalized counts.
- Large mention counts are capped visually as `99+`.
- Mention badges include accessible `aria-label` and `title` text.
- Existing ChannelItem layout and visual design remain unchanged.

## Manual verification

1. Start the app in mock mode.
2. Find a channel with a mention badge.
3. Confirm the badge still renders in the CommunitySidebar.
4. Inspect/hover the badge and confirm mention text is available.
5. Temporarily set a mock channel mention count above 99 and confirm it displays as `99+`.

## Notes

- This task does not yet increment mention counts from background realtime messages.
- Future notification/unread tasks can use `messageMentionsUser` to decide whether a message should increase the mention badge.