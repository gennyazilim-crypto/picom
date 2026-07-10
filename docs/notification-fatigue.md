# Notification Fatigue Reduction

Status: Central routing rules implemented; quiet/digest scheduling remains placeholder where noted

## Central decision path

All desktop/native/browser notification attempts go through `notificationService.showNotification()` and `decideNotificationRoute()`. React components must not call native notification APIs directly.

The decision returns separate outcomes for:

- desktop/native notification;
- notification inbox recording;
- in-app unread state;
- a safe human-readable routing reason.

The inbox may retain quiet/digested/muted events without generating desktop spam. Permission/auth/security checks remain separate from notification preference routing.

## Priority order

Rules are evaluated in this order:

1. Notification setting disabled: do not deliver through this notification route.
2. Global mute or Do Not Disturb: suppress desktop; retain inbox; unread only outside active channel.
3. Active Quiet Hours: suppress according to scope, unless an allowed mention override applies.
4. Mentions-only setting: suppress normal message desktop delivery.
5. Digest mode: group normal messages; mentions/system notifications bypass digest.
6. Muted channel/community: suppress normal messages; direct mentions retain priority.
7. Focused active channel near bottom: suppress desktop, inbox and unread because the user is already reading it.
8. Focused active channel away from bottom: suppress desktop but preserve inbox and unread.
9. Otherwise: allow desktop plus inbox; unread only when not already active.

## Decision table

| Context | Desktop | Inbox | Unread | Rationale |
| --- | --- | --- | --- | --- |
| Focused, active channel, near bottom | No | No | No | User is already reading the event |
| Focused, active channel, scrolled away | No | Yes | Yes | Keep in-app catch-up without OS spam |
| Other channel, normal message | Yes unless muted/quiet/digested | Yes | Yes | User is not viewing the event |
| Muted channel/community, normal message | No | Yes | Yes outside active channel | Mute reduces noise without losing inbox history |
| Muted channel/community, direct mention | Yes unless DND/global mute/quiet policy | Yes | Yes outside active channel | Mention priority overrides channel/community mute |
| Global mute or DND | No | Yes | Yes outside active channel | Explicit focus state overrides mention priority |
| Mentions-only, normal message | No | Yes | Yes outside active channel | Only important direct attention reaches desktop |
| Mentions-only, mention | Yes unless another higher rule suppresses | Yes | Yes outside active channel | Mention remains important |
| Quiet Hours: all | No, except allowed mention | Yes | Yes outside active channel | Scheduled quiet period |
| Quiet Hours: normal messages | Normal message no; mention yes | Yes | Yes outside active channel | Mention priority is preserved |
| Quiet Hours: sounds only | Yes but silent; allowed mention may retain normal sound | Yes | Yes outside active channel | Visual notification without sound fatigue |
| Digest hourly/daily placeholder, normal message | No immediate desktop | Yes/grouped | Yes outside active channel | Lower priority is summarized |
| Digest, mention/system | Normal route | Yes | Context dependent | Important events are not delayed by digest |

## Mention priority boundaries

- `category: "mention"` or `isMention: true` marks a direct mention.
- Mention priority may bypass channel/community mute and normal-message digest.
- Mention priority does not bypass global mute, Do Not Disturb or a Quiet Hours policy that disallows mentions.
- A mention in the focused active channel near bottom does not need a desktop notification.
- Callers must determine mentions from authorized message metadata; do not include message body in native payload diagnostics or analytics.

## Quiet Hours

Current local settings support:

- enabled/disabled;
- start/end in system local timezone;
- overnight ranges;
- all notifications, normal messages only or sounds-only placeholder;
- allow mentions override.

Invalid or equal start/end values fail open to normal routing rather than silently muting all day. Settings persist locally. A backend/user cross-device schedule is not implemented.

## Digest placeholder

- Default is off.
- Hourly/daily modes are explicit placeholders.
- Normal messages can be grouped by community, channel and date in the inbox foundation.
- Mentions and system events are not digested.
- No backend scheduler or delayed native summary is active; the current route suppresses immediate low-priority desktop spam and keeps inbox state.

Before production scheduling, define timezone changes, sleep/wake catch-up, maximum group size, summary copy, stale/deleted/private event filtering, cross-device deduplication and user controls.

## Anti-spam rules for future work

Do not add an in-memory cooldown that can hide important mentions without a persisted/reconciled inbox. A future backend-aware coalescer may:

- collapse repeated normal-message events for the same authorized channel in a short bounded window;
- keep latest safe count/context without message text;
- never collapse direct mentions from different messages into an inaccessible link;
- deduplicate by safe event ID, not content;
- cap native frequency while preserving every inbox record;
- reset safely after sleep/wake/reconnect and avoid replay storms.

## Privacy and security

- Native title/body should contain the minimum user-approved preview; lock-screen privacy controls remain future work.
- Logs record decision reason/category only, not message body, names, tokens, IDs or private channel text.
- Muted/private/inaccessible events must not leak through notification title, body, tag or click action.
- Deep-link activation revalidates current session, membership and channel/message access.
- Notification settings never replace RLS/backend permission enforcement.

## Validation

- `npm run notifications:routing:smoke`
- `npm run notifications:quiet-hours:smoke`
- `npm run notifications:digest:smoke`
- `npm run native-notifications:smoke`

Manual matrix should cover focused/unfocused, active/inactive channel, near-bottom/scrolled, normal/mention, channel/community/global mute, DND, quiet scopes, digest modes, permission denied and runtime unavailable.

## Current decision

No native notification rewrite or new API was needed. Existing central routing meets this task's fatigue-reduction rules. Production digest scheduling and cross-device notification state remain separately gated work.
