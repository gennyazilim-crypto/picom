# Friends System Foundation

Task 283 adds a local beta foundation for a future friends system.

## Current behavior

- Friends are displayed in a desktop-only placeholder view.
- Incoming requests can be accepted or dismissed locally.
- Suggested friends can create local outgoing placeholder requests.
- Existing friends can be starred locally.
- Friends can open the direct message placeholder.

## Boundaries

This task does not add:

- Production friend request backend
- Supabase RLS policies for friendships
- Privacy controls
- Blocked-user integration
- Friend-only direct message enforcement
- Realtime friend activity sync
- Mobile UI

## Future backend requirements

Before production friends are enabled, Supabase must enforce:

- Authenticated-only friend request creation
- Receiver-only accept/dismiss permissions
- Sender-only cancel permissions
- Blocked-user restrictions
- Privacy setting checks
- Rate limits for friend request abuse
- Audit/abuse events for repeated misuse

## Manual test steps

1. Run `npm run dev`.
2. Open a community.
3. Right-click a member.
4. Choose `Open friends foundation`.
5. Accept an incoming request.
6. Send a suggestion request placeholder.
7. Star/unstar a friend.
8. Open a friend direct message placeholder.
9. Return to community chat.
