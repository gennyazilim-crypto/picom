# Slow Mode Placeholder

Status: post-MVP operational/product placeholder

Slow mode is planned as a future channel moderation control that limits how frequently a user can send messages in a channel. This placeholder documents the safe implementation path without changing current MVP message sending behavior.

## MVP stance

- Slow mode is not enabled in the current MVP runtime.
- Existing message sending and composer permission states remain unchanged.
- No channel schema changes or Supabase migrations are added in this task.

## Future product behavior

Potential future channel field:

- `slow_mode_seconds`

Behavior:

- When `slow_mode_seconds > 0`, normal users must wait before sending another message in the same channel.
- Owner/admin/moderator bypass can be considered as a permission-based exception.
- Composer should show a countdown while waiting.
- Backend must remain the source of truth.

## Supabase/RLS and backend expectations

- Message send path must enforce slow mode server-side.
- Frontend countdown is only UX and not security enforcement.
- Slow mode errors should use a consistent error code such as `RATE_LIMITED` or `SLOW_MODE_ACTIVE`.
- Realtime events should not bypass the send mutation path.

## Staging assumptions

- Enable slow mode only on test communities/channels.
- Verify countdown copy, failed send error copy, and moderator bypass behavior.
- Run two-client tests to confirm realtime echoes do not duplicate messages after slow mode rejection.

## Beta assumptions

- Keep slow mode disabled by default.
- Enable only for selected communities if moderators request it.
- Collect feedback on whether the countdown is clear and compact.
- Monitor message send failure rate and support reports.

## Production assumptions

- Roll out behind a feature flag such as `enableSlowMode`.
- Use remote config or backend config to pause the feature if send failures spike.
- Log safe metadata only: user id, channel id, community id, blocked reason, timestamp.
- Never log message content, passwords, tokens, authorization headers, or raw session values.

## Verification checklist

- Normal channels send without delay when slow mode is `0`.
- Slow mode channel blocks rapid repeat sends for normal users.
- Countdown displays in the composer.
- Moderator/admin bypass behaves as configured.
- Backend rejects bypass attempts from normal users.
- Failed optimistic messages are recoverable or removed cleanly.
- No duplicate messages appear after realtime echo.

## Rollback plan

- Disable `enableSlowMode` flag.
- Set affected channels `slow_mode_seconds` to `0` if schema exists.
- Keep message send endpoint compatible with clients that still send slow mode metadata.
- Monitor message send success rate after rollback.

## Known risks

- Client/server clock differences can make countdowns confusing.
- Offline queued messages can fail after reconnect if slow mode is active.
- Realtime echoes can confuse optimistic state if rejection handling is incomplete.
- Too-aggressive limits can feel like broken chat rather than moderation.

## Implementation decision

This task is documentation-only. Runtime countdown, schema changes, and send enforcement are deferred until slow mode is explicitly prioritized.

## Manual verification for this task

- Confirm no slow mode controls appear in the MVP UI.
- Confirm normal message sending still works.
- Confirm this document includes staging, beta, production, rollback, verification, and risk sections.
