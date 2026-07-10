# Logging and Diagnostics Pipeline

## Status

Picom uses centralized, renderer-safe logging and diagnostics services. Existing import paths remain compatible while canonical implementations live under `src/services/logging/` and `src/services/diagnostics/`.

## Pipeline

1. App services write structured entries through `loggingService`.
2. Messages, sources, metadata, errors, and nested values are redacted before retention.
3. The in-memory queue retains at most 250 entries.
4. `diagnosticsService` combines safe app/runtime/service metadata with recent redacted errors and logs.
5. Exports are serialized as JSON or plain text.
6. User-triggered support export continues through `feedbackService` and the safe file/browser fallback.

React components must not create their own native log files, access Node.js, or bypass these services.

## Log levels

- `debug`: development detail that is not required for normal support triage.
- `info`: expected lifecycle and successful service transitions.
- `warn`: recoverable degradation, denied optional behavior, or fallback use.
- `error`: failed core operation or unexpected exception requiring investigation.

The allowlisted typed levels are exported as `LOG_LEVELS`. Production providers may sample debug/info entries, but warning/error retention must remain bounded and privacy-safe.

## Retention

- Maximum in-memory entries: 250.
- New entries evict the oldest entries.
- Diagnostics exports default to the latest 75 entries.
- Crash reports use their separate bounded local queue.
- No persistent production log file or external log provider is enabled by this task.
- Clearing logs does not clear auth sessions, settings, drafts, or crash-report consent.

## Redaction rules

Redaction is applied recursively and handles circular values. Sensitive object keys are replaced even when the value does not resemble a known token.

Protected data includes:

- Passwords and passcodes.
- Access, refresh, session, and general tokens.
- Cookies and raw authorization headers.
- Bearer credentials and JWT-shaped strings.
- API keys, private keys, and signing keys.
- Supabase service-role keys and fields containing Supabase credentials.
- LiveKit API keys/secrets and fields containing LiveKit credentials.

The pipeline also truncates long strings. Redaction is defense in depth: callers must still avoid logging message content, attachment contents, invite secrets, raw auth payloads, and private user data.

## Diagnostics export contents

JSON and text exports include:

- Picom app name, identifier, version, environment, release channel, build date, commit, data-source mode, and runtime target.
- Platform, Electron version, language, online state, and safe window dimensions/focus state.
- Current app view.
- Supabase mode/configuration status and hostname only.
- Realtime and LiveKit status.
- Auth state as `authenticated` or `signed_out` only.
- Recent redacted errors.
- A bounded recent redacted log window.

Exports exclude active community/channel IDs even though those values may exist in the internal runtime snapshot.

## Explicit exclusions

- Passwords, passcodes, or password hashes.
- Tokens, cookies, session values, and JWTs.
- Raw authorization headers.
- Supabase service-role keys or private backend configuration.
- LiveKit API secrets or room tokens.
- Message/attachment contents and arbitrary private user data.
- Native filesystem paths and unredacted environment dumps.

## Export formats

`diagnosticsService.exportDiagnostics("json")` returns the versioned structured payload. `diagnosticsService.exportDiagnostics("text")` returns a support-readable summary followed by redacted errors/logs.

`loggingService.exportLogs("json" | "text", limit)` is available for the logs-only viewer/export path. All returned entries were redacted before entering the queue and are serialized again only from the bounded queue.

## Operational limits

- Current logging is renderer-local and resets on restart unless an explicit user export occurs.
- Counts and recent entries are not a production observability backend.
- Main-process/preload diagnostics need their own safe forwarding adapter if expanded later.
- A future centralized provider must receive only the allowlisted export schema or typed content-free events, never arbitrary renderer state.

