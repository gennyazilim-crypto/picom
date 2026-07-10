# Forum Channels

Picom forum channels provide a desktop post list backed by a root message and a standard Picom thread. Creating a post atomically writes forum metadata, its root message, and its thread; replies use the existing permission-checked thread messages service.

## Permissions and search

Forum list and title/body search use Supabase RLS through the forum channel's `can_view_channel` decision. Private forum titles, tags, counts, and body text are not returned to unauthorized users. Creating a post requires active community membership and access to the exact forum channel. Thread replies re-check membership, channel visibility, and archive status.

## Limits

- A forum list returns at most 100 posts per query.
- Title is limited to 180 characters, body to 4,000, and tags to five unique 30-character values.
- Replies load the latest 100 thread messages under the thread limit.
- Search covers visible title/body fields; global ranking and full-text indexes remain future work.
- Resolved posts are read-only in the current UI; edit, archive, pin, and tag administration remain future work.

## Desktop UI

`ForumChannelView` replaces the normal message list only for forum channels. It includes a post list, bounded search, tag filters, a desktop create modal, and the existing ThreadPanel for replies. Text/voice/announcement layouts are unchanged. No mobile layout, mobile drawer, or bottom sheet is introduced.

## Manual checks

1. Create a post and verify it appears with tags.
2. Open it and send replies through ThreadPanel.
3. Confirm replies do not appear in normal channel MessageList.
4. Search title/body and filter tags.
5. Verify visitors/private-channel unauthorized users cannot list or create posts.
