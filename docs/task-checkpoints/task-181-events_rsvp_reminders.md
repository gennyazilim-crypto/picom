# Task 181: Events RSVP reminders

## Completed

- Added event edit and existing soft-cancel management.
- Added unique member RSVP states with an RLS-backed RPC.
- Added opt-in local reminder scheduling through notificationService.
- Added user-owned reminder preferences for future scheduled backend delivery.
- Documented the explicit no-external-calendar boundary.

## Verification

- `npm run events:foundation:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
