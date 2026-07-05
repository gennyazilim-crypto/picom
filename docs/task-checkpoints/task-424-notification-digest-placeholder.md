# Task 424: Notification Digest Placeholder

## Scope

- Added a local notification digest mode setting.
- Suppressed desktop delivery for low-priority normal messages when digest mode is enabled.
- Kept mentions and system notifications outside digest suppression.
- Added a grouping helper for future inbox summaries by community, channel, and date.

## Validation

- `npm run notifications:digest:smoke`
- `npm run typecheck`
- `npm run build`

## Manual test

1. Open Settings > Notifications.
2. Set Notification digest placeholder to hourly or daily.
3. Trigger a normal message notification route decision.
4. Confirm the route reason says the digest placeholder grouped it.
5. Confirm mention notifications remain outside digest suppression.
