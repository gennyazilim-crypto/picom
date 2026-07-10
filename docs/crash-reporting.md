# Crash Reporting Foundation

Picom exposes a provider-neutral `crashReporterService` with `initialize`, `captureException`, `captureMessage`, `setUserContext`, and `clearUserContext`.

## Current behavior

- Disabled by default and opt-in from Settings > Advanced.
- No DSN, provider secret, network transport, or production upload endpoint.
- At most 50 redacted crash envelopes are stored locally.
- Disabling clears the local queue.
- User context records only `authenticated` or `anonymous`, never a raw user ID.
- The React startup ErrorBoundary captures through both crash recovery and this facade.

## Redaction

All payloads pass through `loggingService.redactDiagnosticsValue`. Passwords, tokens, cookies, authorization headers, Supabase service-role values, LiveKit secrets, signing keys, and private credentials are removed. Test captures must use synthetic data only.

## Future provider integration

A provider adapter may be added only after privacy review, consent copy, data residency, retention, DSN classification, release kill switch, and server-side scrubbing are approved. Provider SDKs must not be called directly from React components.
