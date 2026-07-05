# Safe Mode Startup Foundation

Safe Mode lets Picom start with the basic desktop UI even when optional services, local settings, or startup recovery state are suspected to be unstable.

## Triggers

- repeated startup crash placeholder
- `?safeMode` query flag
- manually persisted safe mode flag
- corrupted local settings placeholder

## Behavior

When Safe Mode is active:

- realtime is paused
- typing and presence subscriptions are paused
- tray event subscription is paused
- notifications are considered paused by user-facing copy
- updates are considered paused by user-facing copy
- remote config/status refresh is skipped
- custom themes are disabled by loading safe default settings
- heavy diagnostics are considered paused

The main desktop UI still renders so users can recover.

## User Actions

Safe Mode banner actions:

- Reset settings
- Clear cache
- Export logs
- Restart normally

## Safety Rules

- Reset settings does not clear auth sessions.
- Clear cache does not clear auth sessions.
- Clear cache does not delete drafts.
- Export logs uses redacted logging output.
- Restart normally clears the safe mode flags and reloads the renderer.

## QA

1. Launch with `?safeMode`.
2. Confirm the Safe Mode banner appears.
3. Confirm community UI still renders.
4. Confirm realtime status remains idle/paused.
5. Click Reset settings and confirm the app remains signed in.
6. Click Clear cache and confirm the app remains usable.
7. Click Export logs and confirm a JSON file is offered.
8. Click Restart normally and confirm the renderer reloads without the banner.
