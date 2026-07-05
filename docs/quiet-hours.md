# Quiet Hours

Quiet Hours lets desktop users suppress lower-priority notifications during scheduled local hours without changing the core notification architecture.

## Current MVP behavior

- Settings > Notifications includes Quiet Hours.
- Start and end times use the desktop system timezone.
- Overnight schedules are supported, for example `22:00` to `07:00`.
- Apply modes:
  - all notifications
  - normal messages only
  - sounds only placeholder
- Mentions can be allowed during Quiet Hours.
- Suppressed notifications can still be recorded in future inbox/digest flows.

## Service behavior

`notificationService.decideNotificationRoute()` checks Quiet Hours before normal message routing.

- Disabled notifications still suppress everything first.
- Muted/DND still suppress before Quiet Hours.
- Mentions bypass Quiet Hours only when `allowMentions` is enabled.
- `sounds_only_placeholder` keeps desktop notification routing available but marks native notification payloads as silent where supported.

## Manual QA

1. Open Settings > Notifications.
2. Enable Quiet Hours.
3. Set a window that includes the current local time.
4. Send a test message notification with category `message`.
5. Confirm the route is suppressed unless it is a mention with mentions allowed.
6. Set apply mode to sounds only and confirm routing remains allowed while native payloads can be silent.
