# Task 183 Checkpoint - Handle Realtime Message Delete

## Completed

- Realtime hard DELETE events are handled by `useSupabaseMessageRealtime` through the `onDelete` callback.
- Active channel state removes the deleted message by id.
- Soft-delete remains handled through UPDATE events where `deleted_at` is set.
- Added a redacted warning log if a hard DELETE event does not include a message id.
- No layout or visual changes were made.

## Manual verification

1. Run Picom in Supabase mode in two desktop windows.
2. Open the same channel in both windows.
3. Delete a message using the app delete flow.
4. Confirm soft-delete UPDATE removes it from the second window.
5. If testing hard DELETE manually in development, delete a row from `public.messages` and confirm the active channel removes the row if the event includes an id.

## Notes

- MVP delete behavior uses soft delete via `deleted_at`.
- Hard DELETE is supported defensively but should remain restricted by database permissions and RLS.
- No message content is written to diagnostics for delete events.