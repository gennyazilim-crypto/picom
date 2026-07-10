# Task 67 - Threads and Advanced Replies

- Added thread model and optional `messages.thread_id` relation.
- Added Start or open thread to the message context menu.
- Added a compact right-side ThreadPanel with read-only and send-permission states.
- Kept thread replies in a separate local/API store so the main MessageList and existing reply MVP remain unchanged.
- Filtered thread message events out of the main channel Realtime subscription.
- Added parent-channel visibility RLS for threads.

Validation: `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.
