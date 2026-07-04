# Task Checkpoint: Mention Feed MVP

## Scope

Implemented the Home Mention Feed MVP for the locked Full MVP scope.

This task intentionally did not implement:

- Full Profile Page
- LiveKit
- Supabase integration
- Direct Messages
- General social posting
- Mobile UI

## Implemented

- Home/Picom rail button now opens a dedicated mention feed view.
- The previous raw `Home placeholder opened` behavior was removed.
- The mention feed has exactly two primary tabs:
  - Feed
  - Takip Ettiğin Kişiler
- Feed tab shows popular people mentions.
- Takip Ettiğin Kişiler tab shows mentions related to followed users.
- Mention cards render author, context, timestamp, body, highlighted mentioned users, optional images, reactions, and stats.
- Mention cards support local:
  - like/react toggle
  - save/unsave
  - mark as read
  - open in channel
  - context menu actions
- MentionRightPanel renders:
  - mention overview
  - popular people
  - following
  - quick filters
- ServerRail remains visible in mention feed mode.
- CommunitySidebar and MemberSidebar are hidden in mention feed mode.
- Opening a community icon returns to the normal community chat layout.
- Opening a mention in channel returns to the community layout and selects the target channel.

## Mock data

- Added typed mention mock data.
- Added at least 25 mention items.
- Includes popular mentions, followed-user mentions, unread mentions, saved mentions, image mentions, and reaction mentions.
- Mock mention items only use visible text channels.
- TODO remains for future Supabase/RLS-backed access filtering.

## Validation

Run:

```bash
npm run typecheck
npm run mock:smoke
npm run build
```

Manual UI smoke:

```bash
npm run dev
```

Then verify:

- Login with the local seed account.
- Click the Picom/Home rail button.
- Confirm the Mention Feed opens.
- Confirm no raw placeholder toast appears.
- Switch between `Feed` and `Takip Ettiğin Kişiler`.
- Try Today, This week, Unread, and Saved quick filters.
- Like/react, save, and mark a mention as read.
- Click Open in channel and confirm the community chat layout returns.
- Click a community icon and confirm the normal 4-column chat layout returns.

## Notes

- Profile clicks still use the existing profile popover because Full Profile Page is a later task.
- Supabase mode is not connected in this task.
- LiveKit is not touched in this task.
