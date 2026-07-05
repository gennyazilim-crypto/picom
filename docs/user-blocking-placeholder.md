# User Blocking Placeholder

Picom prepares local user blocking controls for MVP privacy and safety testing. This is not a production backend block list yet.

## Current behavior

- UserProfilePopover includes Block/Unblock actions.
- The current user cannot block their own account.
- Blocked users are stored locally.
- Messages from blocked users collapse into a compact placeholder.
- Unblocking from the profile popover restores message visibility on the next render.

## Future production requirements

- Supabase/backend should store block relationships per user.
- Blocked users should be prevented from sending DMs/friend requests where those systems exist.
- Backend APIs should filter or mark blocked-user content according to product policy.
- Realtime events should respect blocking preferences without leaking private data.

## Manual verification

1. Open a member profile popover.
2. Click Block.
3. Confirm messages from that user collapse in the message list.
4. Open the same profile and click Unblock.
5. Confirm messages render normally again.