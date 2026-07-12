# Task 565 checkpoint: meeting reconnect, token refresh, and cleanup

## Delivered

- Added reason-aware LiveKit disconnect handling for removed participants, duplicate identity, ended rooms, token failure, and transient provider/network outages.
- Added one bounded meeting reconnect loop that obtains fresh authorization from the secure backend path on every attempt.
- Added cancellable retry and sleep/wake timers plus generation guards for stale asynchronous Room connections.
- Centralized Room disposal so local media, screen-share handlers, listeners, and provider connections are released in order.
- Reconciled provider participants by replacement to prevent ghost identities and cleared meeting state on leave.
- Preserved layout, dock, device, mute/camera, and Noise Shield preferences through recovery while terminal access failures remain non-recoverable.

## Validation contract

Before commit, run the task structural smoke, existing voice reconnect/recovery and extended memory-leak smokes, TypeScript, mock smoke, production build, renderer performance budget, and QA smoke in a clean detached worktree.

## Security and privacy

- Tokens refresh only through the existing authenticated meeting-token Edge Function service.
- No provider secret, token, room identity, or raw media is logged or persisted.
- Removed users and ended rooms are never automatically rejoined.
- No recording path was introduced.

## External evidence

- Hosted two-client reconnect and token-expiry validation: **BLOCKED**, authorized LiveKit staging unavailable.
- Native Windows/Linux/macOS sleep/wake and device-loss validation: **BLOCKED**, native matrix evidence unavailable.
- Long-session heap snapshots: **BLOCKED**, requires a packaged desktop soak run.
