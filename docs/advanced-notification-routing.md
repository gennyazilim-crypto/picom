# Advanced Notification Routing

Status: implemented as centralized decision foundation

Picom now has a centralized notification routing decision helper for future advanced notification behavior. The current native notification service uses this helper before attempting desktop notification delivery.

## Covered decisions

- notifications disabled
- global mute / DND placeholder
- mentions-only mode
- muted channel/community placeholder
- active focused channel near bottom
- active focused channel while reading older messages
- desktop notification allowed fallback

## Current behavior

- `notificationService.showNotification()` calls `decideNotificationRoute()`.
- If the route blocks desktop delivery, the service returns a clean reason instead of trying to notify.
- Existing settings remain compatible: `enabled`, `muted`, `mentionsOnly`.

## Future integration points

The route context can later receive:

- current active channel id
- incoming event channel id
- focused/unfocused app state
- scroll-near-bottom state
- muted channel/community settings
- DND status
- mention detection

## Safety boundaries

- Notification routing must not log message content.
- Notification payloads must not include passwords, tokens, authorization headers, or raw session values.
- Frontend routing is UX only; backend permissions and RLS still control data access.

## Manual verification

1. Toggle notifications off in Settings and send a test notification.
2. Confirm the service returns a suppressed reason.
3. Toggle mentions-only and confirm normal message notifications are suppressed by the routing decision.
4. Confirm build and QA smoke still pass.
