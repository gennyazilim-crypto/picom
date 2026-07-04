# Task 179 Checkpoint - Enable Supabase Realtime for Messages

## Completed

- Added an idempotent Supabase migration to enable realtime for `public.messages`.
- Added a scoped `useSupabaseMessageRealtime` hook.
- Added duplicate-safe local message upsert/update/remove state helpers.
- Connected the active channel subscription in `App.tsx`.
- Documented SQL, environment variables, RLS assumptions, and manual test steps.

## Validation

Run:

```powershell
npm run typecheck
npm run build
```

Optional Supabase smoke check:

```powershell
npm run supabase:smoke
```

## Notes

- This task only covers message row changes.
- Presence, typing, notification routing, and reconnect UI are later realtime tasks.