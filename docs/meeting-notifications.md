# Meeting notifications

Task 541 connects meeting lifecycle events to Picom's recipient-private notification inbox and existing desktop routing policy.

## Events

The backend produces idempotent notifications for reminders, meeting start, schedule changes/cancellation, direct invitations, waiting-room requests/results, cohost assignment, and stage requests. `source_event_id` and the outbox `(recipient_id, event_key)` constraint prevent reconnects, trigger retries, or repeated scheduler runs from creating a notification storm.

## Delivery

`meeting_notification_jobs` is a private outbox. Trigger-originated jobs are delivered immediately when possible. A protected scheduler should call `process_meeting_notification_jobs(now(), 500)` once per minute to claim reminders and retry transient failures. Only `service_role` (or the database owner during controlled operations) can run the worker; authenticated clients cannot inspect or mutate the outbox.

The renderer keeps native delivery separate from persistence. `meetingNotificationService` routes an inserted inbox item through `notificationService`, so notification preferences, DND, Quiet Hours, muted communities/channels, native permission, sound policy, and the emergency kill switch remain authoritative. A focused client already viewing the same meeting suppresses duplicate desktop/in-app noise.

## Time and navigation

Dates are stored as `timestamptz`. The client formats `meeting_starts_at` with `dateTimeService` and an optional IANA time zone. Inbox and native notification clicks carry a validated `picom://meeting/.../room/...[/session/...]` route; no invite secret or provider credential is placed in the URL.

## Hosted verification

The local structural smoke verifies contracts only. Hosted staging must apply migrations, run `supabase/tests/rls/meeting_notifications_reminders.sql`, configure the protected one-minute worker, and verify two recipients with different DND/Quiet Hours and active-room states. Supabase CLI and hosted credentials are intentionally not required by local mock mode.
