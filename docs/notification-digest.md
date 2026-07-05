# Notification Digest Placeholder

Notification Digest prepares Picom to group lower-priority notifications without sending desktop spam.

## Current MVP behavior

- Settings > Notifications includes digest mode:
  - off
  - hourly placeholder
  - daily placeholder
- Digest mode applies only to normal message notifications.
- Mentions and system notifications are not digested by this placeholder.
- `notificationService.decideNotificationRoute()` routes digested normal messages to inbox/unread state and suppresses desktop delivery.
- `notificationDigestService.groupNotifications()` prepares future grouping by community, channel, and date.

## Future backend behavior

- Supabase notification records can be grouped server-side or client-side.
- Digest jobs should respect muted communities/channels, Quiet Hours, DND, and mention override settings.
- Desktop native notifications should summarize digest groups instead of sending one notification per low-priority message.
- Digest payloads must not include private channel content for unauthorized users.

## Manual QA

1. Open Settings > Notifications.
2. Set Notification digest placeholder to hourly or daily.
3. Trigger a normal message notification route decision.
4. Confirm desktop delivery is suppressed with the digest reason.
5. Confirm mention notifications are not suppressed by digest mode.
