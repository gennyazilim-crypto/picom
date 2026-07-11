# Supabase Text Community Messaging Integration

## Production boundary

Text community creation continues through the atomic template RPC. General channel creation now uses `create_managed_text_channel`, which rejects non-Text communities and resolves the effective `manageChannels` permission, including role/channel policy.

Message sends use `send_text_message_idempotent`. The RPC derives the author from `auth.uid()`, validates Text community/channel visibility and effective `sendMessages`, validates same-channel replies, and returns an existing successful row when the same `clientMessageId` and payload are retried. Body, scope, reply target, and attachment IDs are part of that payload; reusing the key for a different payload fails closed.

Up to four pending attachment metadata rows are validated and linked in the same database transaction as the message. The private Storage object lifecycle and signed display URL refresh remain under Task 514.

## Client behavior

- Mock mode keeps local communities/messages and the existing upload preview behavior.
- Supabase mode uses service/RPC boundaries; components do not call Supabase directly.
- Per-channel send queues preserve local order and deduplicate in-flight client IDs.
- Postgres Changes insert/update/delete subscriptions use RLS, ordering guards, optimistic deduplication, generation checks, and cleanup.
- Typing uses throttled private Broadcast topics with expiry.
- Presence uses private authorized topics and removes the channel on scope change/unmount.
- Read markers and unread/mention summaries persist through existing RPCs.
- Edit/delete remain version-aware RPC mutations and reactions remain aggregate-safe RPC mutations.

## Access matrix

| Actor | Public Text | Private Text | Send | Manage channels |
| --- | --- | --- | --- | --- |
| Visitor | Public-read projection only | Hidden | Denied | Denied |
| Member | Visible allowed channels | Permission-dependent | Effective `sendMessages` | Denied by default |
| Moderator/Admin | Visible allowed channels | Permission-dependent | Effective permission | Effective `manageChannels` |
| Owner | Visible | Visible | Allowed | Allowed |

Radio and Podcast communities cannot use the generic Text channel/message mutation boundaries.

## Evidence boundary

Local structural tests cover service routing, idempotency, private access, wrong-kind denial, attachment linking, realtime deduplication, typing throttle, presence cleanup, and pgTAP shape. Real two-client Supabase Realtime and RLS execution remains **BLOCKED** when the Supabase CLI/staging credentials and two synthetic accounts are unavailable.
