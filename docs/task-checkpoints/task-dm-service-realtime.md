# Task checkpoint: Direct Messages service and realtime

## Result

Direct Messages now expose a mock/Supabase-aware service boundary for conversations, messages, reactions, read state, attachments, and replies. React components remain independent of Supabase queries.

Realtime subscription ownership moved into `directRealtimeService`. It validates participant access, subscribes only to allowed conversations, reconciles message and reaction events, deduplicates repeated client-message echoes, and removes all channels when the conversation set changes or the hook unmounts.

## Public service API

- `getDirectConversations()`
- `getDirectMessages(conversationId)`
- `createOrOpenDirectConversation(userId)`
- `sendDirectMessage(conversationId, body, attachments?, replyToMessageId?)`
- `editDirectMessage(messageId, body)`
- `deleteDirectMessage(messageId)`
- `addDirectReaction(messageId, emoji)`
- `removeDirectReaction(messageId, emoji)`
- `markDirectConversationRead(conversationId)`

## Validation

```powershell
npm run typecheck
npm run mock:smoke
npm run build
```

Supabase two-client verification requires configured Auth, applied DM migrations, and Realtime publication. Open the same conversation in two desktop windows, send/edit/delete/react in one window, confirm the second updates once, then switch conversations and confirm stale channels no longer update the UI.
