# Task 48 - Direct Messages UI

Date: 2026-07-10
Status: Complete

## Result
- Split the desktop DM surface into sidebar, conversation list, header, chat main, and composer components.
- Kept ServerRail, Mention Feed, community layout, titlebar, and protected session flow unchanged.
- ProfileView Message opens an existing conversation or creates a local mock conversation.
- Added local DM send behavior, unread badges, and polished empty states.
- Supabase persistence remains behind the Task 47 service/RLS boundary and is not falsely claimed as connected UI behavior.

## Validation
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Manual test
Open another user's profile, choose Message, send a message, switch conversations, and confirm Home/community navigation remains unchanged.
