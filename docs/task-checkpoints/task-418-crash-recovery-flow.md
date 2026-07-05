# Task 418: Crash Recovery Flow

## Scope

- Added a startup crash recovery dialog for the desktop renderer.
- Extended crash recovery state to track previous clean/unclean runtime state.
- Kept existing Safe Mode, auth session, Electron titlebar, and MVP UI stable.

## Implemented

- `crashRecoveryService` now records:
  - startup opened
  - startup stable
  - clean shutdown
  - previous crash prompt dismissal
  - redacted diagnostics export
- `CrashRecoveryDialog` offers:
  - Continue normally
  - Safe Mode
  - Export logs
  - Reset local settings
- `DesktopStartupErrorBoundary` continues to record renderer crashes through centralized logging.
- Logging redaction remains centralized in `loggingService`.

## Validation

- `npm run crash:recovery:smoke`
- `npm run typecheck`
- `npm run build`

## Manual Test

1. Simulate a renderer crash through the error boundary or seed `picom:last-renderer-crash` in local storage.
2. Restart Picom.
3. Confirm the recovery dialog appears once.
4. Confirm Continue normally dismisses the prompt.
5. Confirm Safe Mode restarts with optional services paused.
6. Confirm Export logs downloads redacted diagnostics.
7. Confirm Reset local settings preserves auth and clears recovery prompt.

## Notes

- This is a safe placeholder for unclean shutdown detection because browser/Electron renderer lifecycle events are best-effort.
- No passwords, tokens, cookies, auth headers, or private secrets are included in exported diagnostics.
