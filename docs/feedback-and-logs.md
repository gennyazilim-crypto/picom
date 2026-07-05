# Feedback and Logs Placeholder

Task 279 adds a safe beta placeholder for feedback and support diagnostics.

## Current behavior

- Settings > Advanced exposes a feedback/logs placeholder.
- Feedback is captured locally through `feedbackService.submitPlaceholder()`.
- No feedback report is sent to a backend endpoint yet.
- Users can export a diagnostics JSON payload.
- Native save dialog is used when available.
- Browser download fallback is used when the native file service is unavailable.

## Redaction

Diagnostics use the centralized `loggingService`.

The logging service redacts:

- passwords
- passcodes
- tokens
- cookies
- authorization headers
- JWT-like strings
- API keys
- service-role references
- session-like fields
- private secrets

## User-facing vs developer-facing information

- User-facing feedback copy stays short and non-technical.
- Developer diagnostics are included only in the exported JSON payload.
- Stack traces and logs should be shared only when the tester intentionally exports diagnostics.

## Manual test steps

1. Run `npm run dev`.
2. Open Settings.
3. Go to Advanced.
4. Fill the feedback placeholder fields.
5. Click `Save feedback placeholder`.
6. Confirm a success toast appears.
7. Click `Export diagnostics JSON`.
8. Confirm the native save dialog or browser download fallback appears.
9. Inspect the JSON and confirm no passwords, tokens, cookies, auth headers, service-role keys, or private secrets are present.

## Future backend integration

When a beta feedback endpoint exists, wire `feedbackService.submitPlaceholder()` through a backend-safe API route. Do not send raw logs automatically, and keep diagnostics opt-in.
