# Fatal error boundary UX

Picom's renderer error boundary is a recovery surface, not a technical crash dump. The production screen uses fixed user-facing copy and never renders the exception message or raw stack by default.

## Recovery actions

- **Restart Picom** reloads the renderer through `crashRecoveryService` without changing the signed-in session.
- **Open Safe Mode** records a manual Safe Mode flag, reloads the renderer and pauses optional desktop services.
- **Export support logs** downloads the existing redacted local log export. Passwords, tokens, authorization headers and raw private content remain covered by the logging redaction policy.
- **Copy support details** copies the redacted diagnostics payload for support when a file export is inconvenient.

The screen confirms action outcomes through an `aria-live` status line. Clearing recovery state is intentionally limited to local development diagnostics so users do not accidentally erase evidence before export.

## Developer diagnostics

Exception name, message, stack and the local crash record are passed through `loggingService.redactDiagnosticsValue`. The details panel is compiled into development behavior only and remains closed by default. Production users see no expandable raw stack surface.

## Appearance and accessibility

The full-window recovery surface uses Picom design tokens for the backdrop, card, border, text, focus ring and actions. It therefore follows the early light and dark theme bootstrap. Buttons are keyboard reachable, the screen uses assertive alert semantics, and status updates are announced without moving focus.

## Manual check

In a development build, trigger a renderer error inside the boundary, verify restart/Safe Mode/export/copy actions, and confirm the development details are redacted. Repeat with light and dark themes. For a packaged candidate, confirm the developer diagnostics panel is absent and no raw error message or stack appears.
