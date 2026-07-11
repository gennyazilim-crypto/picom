# Meeting chat linked to Picom messaging

Meeting chat is a context adapter over Picom messaging, not a separate chat product. Message bodies remain in `messages`; attachments, reactions, replies, read state, reports, moderation, mentions, edit/delete, sequence ordering and retention continue to use their existing primitives.

## Context modes

- `linked_channel`: meeting messages are linked to an existing text channel. Community members retain normal channel history; temporary guests see only messages explicitly linked to the active meeting.
- `dedicated_thread`: an existing Picom thread is selected. Meeting messages use its `messages.thread_id`.
- `meeting_source`: Picom creates a root message and thread in the selected text channel, then uses that thread as the durable meeting source.

`meeting_chat_contexts` stores only the binding and preservation policy. `meeting_chat_message_links` stores only source provenance. Neither table duplicates message content.

## Access and expiry

Community members follow existing channel visibility and `sendMessages` permission. Non-member guests require an active, authenticated participant row in the exact live session. Viewers and participants with `canSendChat=false` cannot write. Guest access ends when the session ends, the participant leaves, or the context expiry is reached. Preserved history remains available only through normal community/channel access after the meeting.

RLS projects meeting-linked messages through `can_view_message`, which also protects attachments and reactions. Components call `meetingChatContextService`; they never call Supabase directly.

## Deep links

- `picom://meeting/{communityId}/channel/{channelId}/room/{roomId}/chat`
- `picom://meeting/{communityId}/channel/{channelId}/room/{roomId}/chat/message/{messageId}`
- `picom://meeting/{communityId}/channel/{channelId}/room/{roomId}/session/{sessionId}/chat`
- `picom://meeting/{communityId}/channel/{channelId}/room/{roomId}/session/{sessionId}/chat/message/{messageId}`

Opening a link must resolve the context again. A stale invite or expired session never grants access merely because a URL exists.

## Hosted evidence

Apply the migration in staging, run `supabase/tests/meeting_chat_picom_messaging.sql`, and test member, active guest, expired guest, private channel, reply, reaction, attachment, report and preserved-history paths. Structural local tests do not replace hosted RLS evidence.
