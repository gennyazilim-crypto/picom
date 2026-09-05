# Notification migration dependency schema check

Read-only hosted checks confirmed the pre-existing dependency tables, required columns, `users_are_blocked` function, and recipient-owned notification RLS policies:

- `notifications`, `user_settings`, `profiles`, `friend_request_notifications`, `direct_messages`, `direct_conversation_participants`, `friend_presence`, `friendships`, and `publisher_streams` are present.
- Every migration prerequisite column is present. The notification migration itself adds its new delivery, resource, dedupe, expiry, and localization columns.
- `public.notifications` has RLS enabled with recipient select/update policies.
- `supabase_realtime` exists; `notifications` is not yet a publication member, which is the reviewed migration's explicit idempotent publication step.

Result: `NOTIFICATION_DEPENDENCY_SCHEMA=GO` for the exact pinned migration. No schema change was made during this check.
