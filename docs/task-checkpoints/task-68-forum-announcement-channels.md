# Task 68 - Forum and Announcement Channels Foundation

- Extended ChannelType and Supabase constraints with `forum` and `announcement`.
- Added a desktop ForumChannelView with search, tag chips, post list, and local create placeholder.
- Added announcement icons, subtle message styling, and explicit read-only composer state.
- Added owner/admin `sendAnnouncements` permission in frontend helpers and Supabase send enforcement.
- Preserved channel visibility/private-channel RLS for both new types.
- Kept normal text and voice render paths unchanged.

Validation: `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.
