# Task 52 - Advanced Notification Center

Date: 2026-07-10
Status: Complete

## Result
- Added a titlebar notification button and compact desktop popover.
- Added All, Mentions, Replies, Reactions, and System tabs.
- Rows include icon, title, preview, source context, locale-aware timestamp, and unread state.
- Added mark-read, mark-all-read, and source navigation for community, message, DM, event, and system items.
- Local service is Supabase-adapter ready; desktop delivery remains governed by notificationService, quiet hours, mute, and DND settings.

## Validation
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Manual test
Open the titlebar bell, change tabs, mark items read, mark all read, and open community/DM sources.
