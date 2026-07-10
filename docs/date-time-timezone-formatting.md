# Date, Time, and Timezone Formatting

Picom formats user-facing timestamps through `dateTimeService` so Windows, Linux, and macOS desktop users see dates in their locale and system timezone by default.

## Implementation decision

- Use the built-in `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat` APIs.
- Do not add a date library for the MVP.
- Use the browser/Electron renderer locale (`navigator.languages[0]`, then `navigator.language`) unless a caller passes an explicit locale.
- Use the system timezone by default unless a caller passes an explicit timezone.
- Keep invalid timestamp output safe and non-crashing.
- Resolve malformed locale input safely and fall back to the runtime locale; an invalid explicit timezone falls back to the system timezone.
- Use a language-neutral em dash for invalid/missing timestamp display instead of hardcoded English or Turkish error text.

## Supported formatting helpers

- `formatMessageTime()` for compact chat message times.
- `formatCompactDateTime()` for cards, profile activity, and mention feed context.
- `formatFullTimestamp()` for tooltips, account/session metadata, audit-style timestamps, and maintenance windows.
- `formatRelativeTime()` for notification-style timestamps.
- `formatAuditTimestamp()` as an audit-log alias for full timestamps.
- `formatNotificationTimestamp()` as a notification alias for relative timestamps.
- `formatEventRange()` for future community event start/end display.

## Current runtime coverage

- Message item timestamps.
- Mention Feed card timestamps.
- Direct message placeholder timestamps.
- Full Profile recent activity timestamps.
- Maintenance estimated end timestamp.
- Moderation filter saved timestamp.
- Settings active session timestamps.
- Community events and Mention Feed companion event cards.
- Community audit logs and moderation metadata.
- Community insights generation time and the redacted local logs viewer.

## Manual locale/timezone examples

Use the same ISO sample, such as `2026-07-10T18:30:00Z`, without changing stored data:

1. Run Picom with `en-US` and the system timezone set to America/New_York; verify the displayed local date/time and timezone abbreviation.
2. Run with `tr-TR` and Europe/Istanbul; verify `Intl` changes date order, month/weekday labels and 12/24-hour convention as provided by the runtime.
3. Open messages, Mention Feed, profile activity, community events, audit log, insights and Logs in each environment.
4. Verify full timestamps remain available as tooltips where compact times are used.
5. Pass a malformed mock timestamp and confirm a neutral `—` appears without a renderer crash.
6. Pass an invalid explicit timezone in a development test and confirm formatting falls back to the system timezone.

## QA checklist

1. Open Picom at 1440x900 in mock mode.
2. Verify message timestamps show compact local time.
3. Open Mention Feed and verify card timestamps include date and time.
4. Open a full profile and verify recent activity timestamps are compact.
5. Open Settings > Account and verify session timestamps are full and readable.
6. Change the operating-system locale to Turkish and confirm month/day order localizes.
7. Change the operating-system timezone and confirm stored UTC/ISO values render in the new local timezone after restart.
8. Confirm invalid or missing timestamps show `—` and do not crash the renderer.

## Known gaps

- Full i18n key extraction is separate from date/time formatting.
- Provider-originated Supabase/LiveKit errors still need localized user-facing mapping.
- Community events can use `formatEventRange()` when the event UI is expanded.
