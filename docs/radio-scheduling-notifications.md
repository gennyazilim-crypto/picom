# Radio Scheduling and Notifications

## Architecture

Picom uses persisted `radio_sessions.starts_at` values as the schedule source of truth. A user reminder is stored once in `radio_session_reminders`, protected by self-only RLS and the existing Radio visibility boundary.

The renderer accesses reminders through `radioScheduleReminderService` and `useRadioScheduleReminders`. Components never query Supabase directly.

## Delivery rules

- Reminder lead time defaults to 15 minutes.
- Schedule changes, cancellations, transition to live, and due reminders use distinct event keys.
- `claim_radio_session_reminder_event` atomically claims an event before delivery, preventing duplicate notifications after reconnects or multiple active clients.
- Desktop delivery is routed through `notificationService`.
- Notification settings, Do Not Disturb, quiet hours, muted communities, and the native notification kill switch remain authoritative.
- Picom does not request notification permission while synchronizing reminders. Desktop delivery occurs only when permission is already granted; eligible events can still appear in the in-app notification center.
- Terminal reminders remain as non-visible tombstones so stale reconnects cannot recreate duplicate cancellation or ended events.

## Time zones

Schedule storage is UTC `timestamptz`. Radio communities supply an IANA schedule timezone. `dateTimeService` formats day keys, day labels, and times with `Intl.DateTimeFormat`, so the Calendar Lite UI does not group broadcasts using the workstation timezone by accident.

## Validation

Run:

```powershell
npm run radio:scheduling-notifications:smoke
npm run radio:service-realtime:smoke
npm run supabase:smoke
npm run typecheck
npm run mock:smoke
npm run build
```

Real hosted delivery and RLS evidence still requires a configured Supabase project and authenticated test users. Structural smoke checks do not claim hosted evidence.
