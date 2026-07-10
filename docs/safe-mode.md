# Safe Mode Startup Foundation

Safe Mode lets Picom start with the basic desktop UI even when optional services, local settings, or startup recovery state are suspected to be unstable.

## Triggers

- repeated startup crashes (two consecutive failed starts)
- `?safeMode` query flag
- manually persisted safe mode flag
- corrupted local settings detected during settings load
- failed local-data migration or a renderer storage policy/quota failure

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
- voice subscriptions and voice UI service loading are paused
- remote block-list refresh is paused while existing local safety state remains available
- optional startup listeners (deep links and sleep/wake resume) are not started
- crash-reporting provider initialization is skipped; an on-demand fatal capture may still retain a redacted local recovery record

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
- A successful stable startup resets the repeated-crash counter; a subsequent new crash starts a fresh count.
- The startup error screen offers an explicit Open Safe Mode action after a renderer exception.
- A migration failure can force safe mode in memory even when local storage cannot persist the flag.

## Loop prevention

Safe Mode is never exited automatically. `Restart normally` clears forced reason and crash count before one normal renderer reload. If that normal attempt crashes again, the counter starts from one rather than immediately forcing another safe-mode loop. A stable renderer resets the count after three seconds. Query-flag safe mode remains explicit until the launch URL no longer contains `safeMode`.

## QA

1. Launch with `?safeMode`.
2. Confirm the Safe Mode banner appears.
3. Confirm community UI still renders.
4. Confirm realtime status remains idle/paused.
5. Click Reset settings and confirm the app remains signed in.
6. Click Clear cache and confirm the app remains usable.
7. Click Export logs and confirm a JSON file is offered.
8. Click Restart normally and confirm the renderer reloads without the banner.
9. Run `npm run safe-mode:final:test` to execute corrupted-settings, recovery-action, crash-threshold, stable-reset, query-flag and one-reload loop checks against the production services.
