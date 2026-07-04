# Channel Update/Delete Placeholder

Task 150 prepares channel update and delete operations without enabling destructive runtime behavior yet.

## What exists

- `channelService.updateChannel(input)` is typed and validates `channelId`.
- `channelService.deleteChannel(input)` is typed and validates `channelId`.
- Channel context menu actions call the service placeholders and show safe toast feedback.

## What intentionally does not exist yet

- No edit channel modal.
- No delete confirmation modal.
- No Supabase update/delete mutation.
- No local state mutation for edit/delete.

This keeps the MVP safe while preserving a clear service boundary for future channel CRUD work.

## Future implementation notes

When enabled, channel deletion should require confirmation, keep active channel state valid, respect Supabase RLS, and preserve auditability. Channel updates should normalize names through the same service helper used by channel creation.

## Manual verification

1. Open a community.
2. Right-click a channel.
3. Click `Edit channel placeholder`.
4. Confirm a toast explains editing is prepared but not enabled.
5. Right-click the channel again.
6. Click `Delete channel placeholder`.
7. Confirm a toast explains deletion is prepared but not enabled.
8. Confirm the channel list and active channel remain unchanged.