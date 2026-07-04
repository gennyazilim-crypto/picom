# Message Edit Mutation

Task 154 adds a typed message edit mutation foundation.

## API

`messageService.editMessage(input)` accepts:

- `messageId`
- `body`

It returns:

- `id`
- `body`
- `editedAt`

## Mock mode

Mock mode returns an edited message summary without touching UI state. A future inline editor can use this response to update local state safely.

## Supabase mode

Supabase mode updates `public.messages` by id, sets `edited_at`, and ignores already deleted messages. RLS remains the source of truth for whether the current user can edit the message.

## Current scope

No inline edit UI is added in this task. Existing MVP chat rendering remains unchanged.