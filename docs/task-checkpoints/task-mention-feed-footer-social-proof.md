# Mention Feed footer social proof

## Scope
- Standardized Mention Feed card footers with compact social proof.
- Kept the existing Feed and `Takip Ettiğin Kişiler` tabs, quick filters, profile opening, and Open in channel behavior.
- Used mock/local data only.

## Completed
- Added reusable `MentionFeedFooter`.
- Added `EmojiReactionSummary` with emoji-only reaction labels and total count.
- Added `CommentAvatarStack` with overlapping commenter avatars and `+N` overflow.
- Added `MentionCommentPreview` for up to two safe plain-text comment previews.
- Added mock mention commenter/comment preview data.
- Replaced text reactions such as `Like`, `Fire`, `Boost`, and `Eyes` in Mention Feed mock data with emoji reactions.
- Added a Coolicons-style `eye` icon to `AppIcon`.

## Verification
- Run `npm run typecheck`.
- Run `npm run mock:smoke`.
- Run `npm run build`.

## Manual test steps
1. Open Home/Picom Mention Feed.
2. Confirm cards show views, emoji reactions, commenter avatar stack, and comment count.
3. Confirm cards with more than four commenters show a `+N` badge.
4. Confirm cards with no reactions hide the reaction pill cleanly.
5. Switch between `Feed` and `Takip Ettiğin Kişiler`.
6. Use quick filters and Open in channel.
7. Toggle Save/Saved, Mark read, and React.
8. Confirm light/dark mode remains polished and no mobile UI appears.
