# Task 17 - Feedback + Logs + Diagnostics

## Status

Implemented beta-ready local feedback, diagnostics, and logs surfaces.

## Delivered

- Structured Feedback modal with all Full MVP issue categories.
- Copy-only report flow; no backend submission is claimed or simulated.
- Diagnostics copy/export with app, runtime, backend host-only, realtime, LiveKit, and active-view context.
- Authentication is summarized only as `authenticated` or `signed_out`; no session or token data is included.
- Redacted log viewer with level/source/text filters, copy, export, and clear.
- Compatibility re-exports under `services/logging` and `services/diagnostics`.
- No external support backend or analytics integration.

## Redaction

Passwords, tokens, cookies, authorization headers, service-role values, LiveKit secrets, API keys, signing/private keys, sessions, and JWT-shaped strings are removed before export.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run logs:smoke`
- `npm run diagnostics:smoke`
- `npm run secrets:smoke`
- `npm run build`
