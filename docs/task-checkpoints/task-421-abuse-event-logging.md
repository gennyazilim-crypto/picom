# Task 421: Abuse Event Logging

## Scope

- Added a centralized local abuse event logging foundation.
- Routed abuse diagnostics through `loggingService` redaction.
- Added a development Admin Operations summary card.
- Documented the future Supabase-backed abuse event model.

## Safety decisions

- No passwords, tokens, cookies, authorization headers, raw IP addresses, or private message content are stored.
- Event metadata is filtered before being passed to centralized logging.
- User-facing block messages remain friendly and non-technical.
- Developer diagnostics remain redacted and separate.

## Validation

- `npm run abuse:events:smoke`
- `npm run typecheck`
- `npm run build`

## Manual test

1. In development, record a local event through `abuseEventService.recordEvent()`.
2. Open Settings > Advanced > Admin Operations.
3. Confirm the Abuse events card shows aggregate counts only.
4. Confirm logs contain redacted metadata and no private message content.
