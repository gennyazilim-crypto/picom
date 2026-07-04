# Reactions Service

Task 156 adds the MVP reaction service boundary.

## API

`reactionService.addReaction(input)` accepts:

- `messageId`
- `emoji`
- `userId` optional

`reactionService.removeReaction(input)` accepts the same fields and returns a removed summary.

## Mock mode

Mock mode returns local reaction summaries without requiring a backend. This keeps the desktop MVP usable during local development.

## Supabase mode

Supabase mode writes to and deletes from `public.message_reactions`. If `userId` is not provided, the service resolves the authenticated Supabase user. RLS remains the source of truth for whether reactions are allowed.

## Validation

The service validates:

- message id
- non-empty emoji
- emoji length up to 32 characters

## Current scope

No new reaction UI is added in this task. Existing message rendering remains unchanged.