# Message Moderation Filters Placeholder

Picom prepares local message moderation filters for MVP testing. This does not replace backend enforcement.

## Current behavior

- Owner/Admin/Moderator users see a moderation filter card in the community sidebar.
- Blocked words are saved locally per community.
- Max mention count is saved locally per community.
- Message sending checks the local filter before calling the message service.
- Blocked messages show a toast and are not sent locally.

## Future production requirements

- Supabase/backend message send must enforce moderation settings.
- Blocked-word hits should create safe moderation/abuse events without storing sensitive message content unnecessarily.
- Realtime clients must not bypass backend checks.
- Moderation settings should require manage/moderation permissions through RLS or trusted backend routes.

## Manual verification

1. Open a mock owner/admin/moderator community.
2. Add a blocked word in the moderation filter card.
3. Try sending a message containing that word.
4. Confirm a toast appears and the message is not sent.