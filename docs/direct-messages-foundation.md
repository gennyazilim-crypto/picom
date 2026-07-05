# Direct Messages Foundation

Task 282 adds a safe direct messages foundation without enabling production DMs.

## Current behavior

- Direct messages are available as a desktop-only placeholder view.
- The view uses deterministic local mock conversations.
- Member context menus can open the direct message placeholder for known mock participants.
- Sending direct messages is intentionally paused.
- No Supabase DM tables, RLS policies, realtime channels, or storage paths are claimed as production-ready in this task.

## Boundaries

This task does not add:

- Production DM backend
- Message requests
- Friend-only privacy rules
- Blocking integration
- Realtime DM sync
- Attachment upload for DMs
- Mobile UI

## Future backend requirements

Before production DMs are enabled, Supabase must enforce:

- Conversation participant access through RLS
- Message insert/read permissions
- Attachment access rules
- Realtime authorization per conversation
- Blocked-user and privacy-settings behavior

## Manual test steps

1. Run `npm run dev`.
2. Open a community.
3. Right-click a member in MemberSidebar.
4. Choose `Open direct message`.
5. Confirm the desktop DM placeholder opens.
6. Select different mock conversations.
7. Click `Back to community chat`.
8. Confirm the normal four-column community layout returns.
