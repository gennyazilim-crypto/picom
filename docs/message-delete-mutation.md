# Message Delete Mutation

Task 155 adds a typed message delete mutation foundation.

## API

`messageService.deleteMessage(input)` accepts:

- `messageId`

It returns:

- `id`
- `deletedAt`

## Delete strategy

The Supabase mutation performs a soft delete by setting `deleted_at`. This keeps future audit/moderation and realtime reconciliation safer than hard deletion.

## Mock mode

Mock mode returns a deletion summary without mutating UI state. A later UI task can use this to hide or mark messages as deleted locally.

## Current scope

No delete confirmation modal or message-list mutation is added in this task. Existing chat rendering remains unchanged.