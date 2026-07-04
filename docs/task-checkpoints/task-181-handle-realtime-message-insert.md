# Task 181 Checkpoint - Handle Realtime Message Insert

## Completed

- Realtime INSERT events are handled by `useSupabaseMessageRealtime` and routed into `upsertLocalMessage`.
- Local message append is now duplicate-safe by message id.
- If a realtime echo arrives before the send mutation returns, the later local append updates the existing message instead of duplicating it.
- Existing attachment previews are preserved when the local send path enriches a message that already arrived through realtime.
- Message order remains stable by `createdAt`.

## Manual verification

1. Run Picom in Supabase mode in two desktop windows.
2. Open the same channel in both windows.
3. Send a message from window A.
4. Confirm window B receives one message.
5. Confirm window A does not show a duplicated copy after the realtime echo.
6. Repeat quickly with several messages.

## Notes

- This task only covers INSERT behavior and duplicate prevention.
- UPDATE/DELETE behavior remains covered by the active realtime hook and is refined in later tasks if needed.