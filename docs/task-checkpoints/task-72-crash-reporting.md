# Task 72 - Crash Reporting Provider Integration Placeholder

- Added provider-neutral crash reporting facade and ErrorBoundary integration.
- Added opt-in Settings > Advanced diagnostic report toggle.
- Added safe development test capture and local queue status.
- Reused centralized redaction for credentials and sensitive metadata.
- Kept provider disabled by default with no DSN, secret, or network upload.
- User context never stores a raw user identifier.

Validation: safe test capture, existing redacted log export, `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.
