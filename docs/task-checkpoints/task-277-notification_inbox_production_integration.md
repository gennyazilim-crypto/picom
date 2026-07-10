# Task 277 checkpoint: notification inbox production integration

## Completed

- Added recipient-only notification inbox schema, indexes, soft-delete, and RLS.
- Added production list/read/read-all/delete/realtime service operations.
- Kept localStorage as the backend-unavailable cache and mock fallback.
- Routed local inbox additions through the existing preferences/DND decision.
- Added a compact remove action without redesigning the inbox.
- Documented the backend-inbox/client-native-notification boundary.

## Verification

- `npm run notification-inbox:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Remaining environment check

Apply `20260710210000_notification_inbox_production.sql` in a Supabase test project and verify two-session realtime, recipient isolation, mark-all, and soft-delete. No hosted/CLI pass is claimed here.
