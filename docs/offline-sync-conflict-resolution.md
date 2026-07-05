# Offline sync conflict resolution

Picom does not yet include a full offline action queue. This foundation defines how queued or failed actions should be classified so future offline sync work can recover safely without duplicating messages or hiding user data.

## Current runtime slice

- `src/services/offlineSyncConflictService.ts` classifies sync failures.
- Message send failures use this service for safer user-facing copy.
- No automatic retry loop is added in this task.
- No messages, attachments, or reactions are persisted to a new offline queue yet.

## Supported queued action types

- `sendMessage`
- `editMessage`
- `deleteMessage`
- `addReaction`
- `uploadAttachment`

## Conflict codes

- `offline`
- `backend_unreachable`
- `channel_deleted`
- `permission_lost`
- `message_deleted`
- `attachment_failed`
- `duplicate_client_message`
- `slow_mode`
- `rate_limited`
- `unknown`

## Recovery actions

The service returns one or more recovery action hints:

- `retry`
- `remove`
- `copy_text`
- `wait`
- `reopen_channel`
- `sign_in`

Future UI work can use these hints to show retry/remove/copy buttons on failed queued messages.

## Conflict handling rules

- Channel deleted: do not retry automatically; let the user remove the action or pick another channel.
- Permission lost: do not retry automatically; backend remains the source of truth.
- Message deleted before queued edit: keep the failed edit recoverable so the user can copy text.
- Attachment upload failed: retry or remove the attachment.
- Duplicate `clientMessageId`: remove the duplicate local action because the server already accepted it.
- Slow mode/rate limit: wait before retrying; do not retry aggressively.
- Backend unreachable/offline: keep user text recoverable and retry only after explicit reconnect logic exists.

## Future queue requirements

When Picom adds a real offline queue, it should store:

- action id
- action type
- community id
- channel id
- message id or `clientMessageId`
- user-visible text copy if needed for recovery
- attachment references that can be safely retried
- created time
- attempt count
- last conflict code

The queue must not store passwords, tokens, authorization headers, or raw private secrets.

## Manual verification

1. Disable network or point Supabase config at an unavailable backend.
2. Try sending a message.
3. Confirm Picom shows a recoverable connection message instead of a raw technical error.
4. Restore the connection and send a normal message.
5. Confirm no duplicate messages appear.

## Known limitations

- This task does not implement a full offline queue.
- Failed queued message row UI with retry/remove buttons is deferred.
- Upload cancel/retry is handled by a later upload reliability task.
