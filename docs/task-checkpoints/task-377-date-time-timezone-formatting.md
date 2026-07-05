# Task 377 - Date/time/timezone Formatting

## Scope

Added a centralized date/time formatting service and connected the main MVP timestamp surfaces without changing layout or adding dependencies.

## Completed

- Added `dateTimeService` using native `Intl` APIs.
- Added message, compact, full, relative, audit, notification, and event range helpers.
- Updated message, mention feed, DM placeholder, profile activity, maintenance, moderation, and settings session timestamps to use the service.
- Documented locale/timezone behavior and QA steps.
- Added a focused smoke test for service and runtime wiring.

## Validation

- `npm run date-time:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

- The service uses renderer locale and system timezone by default.
- No external date library was added.
