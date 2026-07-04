# Supabase Realtime Messages

Task 179 enables the MVP message realtime path for active text channels.

## Runtime behavior

- The renderer uses the normal Supabase authenticated client.
- React components do not call raw Supabase APIs directly.
- `useSupabaseMessageRealtime` subscribes to `public.messages` changes for the active channel.
- The hook listens for:
  - INSERT: add/update a message by id.
  - UPDATE: update edited messages or remove soft-deleted messages.
  - DELETE: remove hard-deleted messages if a future admin path uses hard delete.
- The local message store performs idempotent upserts to prevent duplicate messages from realtime echoes.

## Required Supabase SQL

The migration `supabase/migrations/20260704002400_enable_messages_realtime.sql` adds `public.messages` to the `supabase_realtime` publication if it is not already present.

```sql
alter publication supabase_realtime add table public.messages;
```

The committed migration wraps that in an idempotent `do $$` block.

## Security assumptions

- The client uses the anon key plus the user's Supabase Auth session.
- The renderer never uses a service-role key.
- Existing message RLS policies remain the authorization boundary.
- Realtime events should only expose rows the authenticated user can access through policy.
- Private-channel policy coverage must be reviewed before expanding private channels beyond MVP assumptions.

## Environment variables

- `VITE_DATA_SOURCE=supabase`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Manual verification

1. Apply migrations to the local/staging Supabase database.
2. Run Picom with Supabase data source enabled.
3. Log in as a seeded user in two desktop windows.
4. Open the same community and channel in both windows.
5. Send a message in window A.
6. Confirm window B receives the message without refresh.
7. Edit or delete the message where supported and confirm window B updates.
8. Switch channels and confirm only the active channel subscription receives messages.

## Remaining work

- Presence and typing events are not part of this task.
- Attachment linking to persisted messages is still a later task.
- Reconnect status UI can be improved in later realtime reliability tasks.