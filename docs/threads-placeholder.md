# Threads Production Foundation

Picom can start or open one thread per parent message, render focused replies in the desktop ThreadPanel, and keep thread replies out of the main chat timeline.

## Permissions and isolation

Thread creation requires send permission in the exact parent channel. The backend verifies the parent message belongs to the supplied community/channel and is not itself a thread reply. Reply RPCs re-check thread visibility, channel send permission, archive state, and authenticated identity. Private-channel rules flow through `can_view_thread` and `can_view_channel`.

## Unread summary and realtime

Each user has a separate thread read timestamp. The summary returns reply count, unread count, and last reply time without exposing unrelated message content. An open panel marks replies read and subscribes only to its thread. Realtime and list-query filters prevent thread replies from appearing in main chat.

## documented limits

- The panel loads the latest 100 messages. Older-reply pagination is deferred.
- One thread is allowed per parent message.
- Attachments, reactions, reply-to-reply, member subscriptions, search, and notification fan-out remain future work.
- Archived threads are read-only.
- Thread summaries are loaded when a thread opens; channel-wide summary badges are deferred to avoid expensive fan-out queries.

## Manual checks

1. Start/open a thread from a visible parent message.
2. Send replies from two windows and verify deduplicated realtime updates.
3. Confirm replies never render in the parent MessageList.
4. Confirm private-channel/visitor access is denied and archived threads are read-only.
5. Reopen a thread and verify its unread summary/read marker.
