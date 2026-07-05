# Saved Messages Foundation

Status: post-MVP foundation

Saved messages are planned as a future personal utility feature for Picom. This foundation documents the safe architecture without changing the current MVP desktop layout, MessageList, context menus, or Home/Mention Feed behavior.

## MVP stance

- Saved messages are not enabled in the current MVP runtime.
- Existing MessageList, MessageComposer, context menus, and Home/Mention Feed remain unchanged.
- No new sidebar item or view is added yet, so the 4-column desktop layout stays stable.

## Future data model placeholder

A future `saved_messages` table can use safe fields:

- `id`
- `user_id`
- `message_id`
- `created_at`

Suggested constraints:

- unique `(user_id, message_id)`
- foreign key to message
- access restricted to the saving user

## Supabase/RLS expectations

- A user can only list their own saved messages.
- A user can only save messages they are allowed to view.
- Private channel saved messages must not leak if the user later loses channel access.
- Deleted messages should show a safe fallback.
- Revoked or expired sessions must not return saved message data.

## Future service methods

Potential typed methods:

- `listSavedMessages(cursor)`
- `saveMessage(messageId)`
- `unsaveMessage(messageId)`
- `isMessageSaved(messageId)`

Writes should be idempotent so repeated save requests do not create duplicates.

## Future UI placeholder

Potential desktop UI entry points:

- Message context menu > Save message
- Message context menu > Unsave message
- Home area > Saved Messages view
- Command Palette > Saved Messages

Saved message rows should include:

- community
- channel
- author
- preview
- timestamp
- jump button placeholder

All UI should use Picom design tokens and avoid mobile navigation.

## Jump behavior placeholder

Future jump to saved message should:

- switch community
- switch channel
- fetch message context if needed
- scroll and highlight message
- show a clear error if deleted or inaccessible

## Privacy and logging

- Do not export saved message content in diagnostics by default.
- Do not log message content when saving or unsaving.
- Do not include tokens, authorization headers, passwords, or raw session values.
- Saved messages are personal data and should be included only in a future user data export with proper access checks.

## Feature flag behavior

A future `enableSavedMessages` flag should hide entry points when disabled. Backend RLS remains mandatory.

## Implementation decision

This task is documentation-only. Runtime context menu actions, Supabase migrations, and Saved Messages view are intentionally deferred.

## Manual verification

- Confirm no Saved Messages view appears in the MVP UI.
- Confirm message context menus behave as before.
- Confirm the 4-column layout remains stable with no horizontal overflow.
