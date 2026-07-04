# Task 182 Checkpoint - Handle Realtime Message Update

## Completed

- Realtime UPDATE events now handle both edited messages and soft-deleted messages.
- Non-deleted UPDATE events use duplicate-safe upsert behavior.
- If an UPDATE event arrives before an INSERT event, the message can still appear in the active channel instead of being dropped.
- Soft-deleted messages are removed from the local active channel view.
- Existing premium desktop layout and scroll behavior were not changed.

## Manual verification

1. Run Picom in Supabase mode in two desktop windows.
2. Open the same channel in both windows.
3. Send a message in window A.
4. Edit the message where the UI/API path supports it.
5. Confirm window B updates the body/edited state.
6. Delete the message where supported.
7. Confirm window B removes the soft-deleted message.

## Notes

- This task does not add a visible edited label if the message item does not already render one.
- Reactions, typing, and presence are later realtime tasks.