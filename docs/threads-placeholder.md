# Threads Placeholder

Status: post-MVP placeholder

Threads are planned as future side discussions connected to a parent message. This placeholder documents the architecture and guardrails without adding a ThreadPanel or changing the current MVP message layout.

## MVP stance

- Threads are not enabled in the current MVP runtime.
- Existing MessageList, MessageComposer, replies, reactions, attachments, and realtime message flow remain unchanged.
- No right-side thread panel is added yet, so MemberSidebar and ChatMain layout stay stable.

## Future data model placeholder

A future `threads` table can use safe fields:

- `id`
- `community_id`
- `channel_id`
- `parent_message_id`
- `name`
- `created_by_id`
- `created_at`
- `archived_at`
- `deleted_at`

Thread messages can reuse the existing messages model with an optional `thread_id` when the schema is ready.

## Supabase/RLS expectations

- Users can view a thread only if they can view the parent channel and parent message.
- Private channel thread data must not leak to unauthorized users.
- Creating a thread requires `sendMessages` permission in the parent channel.
- Posting in a thread requires channel/thread access and a valid Supabase Auth session.
- Deleted parent messages should show a safe fallback without exposing deleted content.

## Future service methods

Potential typed methods:

- `startThread(messageId, payload)`
- `openThread(threadId)`
- `fetchThreadMessages(threadId, cursor)`
- `sendThreadMessage(threadId, payload)`
- `archiveThread(threadId)`

All write operations should reconcile optimistic local state with Supabase confirmation and realtime echoes.

## Future UI placeholder

Potential desktop UI entry points:

- Message context menu > Start thread
- Message context menu > Open thread
- Thread panel on the right, replacing or overlaying MemberSidebar only when explicitly opened
- Thread modal fallback if panel would crowd the desktop layout

No mobile-style drawer, bottom sheet, or responsive phone layout should be introduced.

## Realtime behavior

Future realtime events:

- `thread:created`
- `thread:archived`
- `thread:message_new`
- `thread:message_update`
- `thread:message_delete`

Clients should deduplicate by `eventId` and prevent thread messages from being rendered in the parent channel list unless explicitly represented as a thread summary.

## Performance notes

- Thread messages should use pagination.
- Opening a thread should not refetch the entire channel history.
- Thread unread state should be stored separately from channel read state when implemented.

## Security notes

- Do not expose messages from private channels through thread search or deep links.
- Do not log raw thread message content in diagnostics.
- Do not include tokens, passwords, authorization headers, or session values in thread-related logs.

## Feature flag behavior

A future `enableThreads` flag should hide thread entry points. Backend RLS and permissions remain mandatory and cannot be replaced by frontend flags.

## Implementation decision

This task is documentation-only. Runtime ThreadPanel, context menu actions, Supabase migrations, and thread services are intentionally deferred.

## Manual verification

- Confirm existing message context menu still behaves as before.
- Confirm no ThreadPanel appears in the MVP UI.
- Confirm MemberSidebar and ChatMain layout remain stable.
