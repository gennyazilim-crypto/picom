# Task 409: Unified error UX

## Scope
- Hardened Picom's centralized error UX boundary without changing the desktop layout or adding new product features.
- Kept the existing logging and diagnostics architecture as the source of truth.

## Completed
- Added `loggingService.captureUserError()` for consistent user-facing error notices backed by redacted diagnostics.
- Fixed `loggingService.formatUserError()` so known error codes can use their mapped friendly messages instead of always falling back to the generic text.
- Updated the startup error boundary to show recovery-focused copy to users and redacted developer diagnostics in the details block.
- Expanded error smoke coverage for the unified UX boundary.
- Documented the expected inline/toast/blocking/diagnostics error surfaces in `docs/error-codes.md`.

## Verification
- Run `npm run errors:smoke`.
- Run `npm run typecheck`.

## Manual test steps
1. Trigger a recoverable service error and confirm the visible message is friendly and non-technical.
2. Trigger a renderer startup crash in development and confirm the main card does not expose stack traces.
3. Expand Developer diagnostics and confirm technical details are present but redacted.
4. Confirm passwords, tokens, cookies, authorization headers, and service keys are not shown in user-facing UI.

## Notes
- This task does not alter Supabase, LiveKit, chat layout, community navigation, or Electron window behavior.
