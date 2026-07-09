# Picom Feedback and Diagnostics

Picom beta keeps support reports local. Users can prepare, copy, or export a structured report; no external support backend is called.

## Feedback flow

Settings > Diagnostics opens the report form with issue type, title, description, and explicit diagnostics/log inclusion choices. Submit creates a local reference only. Copy report produces a redacted JSON payload suitable for a trusted support channel.

## Diagnostic fields

- app version, environment, build, and release channel;
- Windows/Linux/macOS platform and Electron version when available;
- mock or Supabase data source mode;
- Supabase URL host only;
- realtime and LiveKit configuration status;
- active view, community ID, and channel ID;
- latest safe API error summary;
- recent redacted logs when explicitly selected.

## Redaction boundary

`loggingService` recursively redacts sensitive keys and string patterns before entries enter the in-memory log list. It removes or masks passwords, passcodes, tokens, cookies, authorization headers, sessions, JWTs, API keys, service-role values, signing/private keys, and LiveKit/Supabase secrets. Strings and log history are bounded.

Reports must never include passwords, auth tokens, authorization headers, Supabase service-role keys, LiveKit API secrets, cookies, or private keys. Message content is not automatically collected as diagnostics.

## Logs viewer

The local viewer supports level, source, and text filters; selected-log copy; JSON export; and clear. Exports use the safe file service and browser fallback behavior. Logs are memory-bounded and are not uploaded.

## Beta test notes

Use fake secret-shaped values when validating redaction. Never put real credentials into test logs. Run `npm run logs:smoke`, `npm run diagnostics:smoke`, and `npm run secrets:smoke` before beta packaging.
