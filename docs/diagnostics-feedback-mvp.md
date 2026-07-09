# Picom Feedback, Logs, and Diagnostics MVP

## Feedback flow

Picom does not have a beta feedback backend endpoint. The Feedback modal creates a structured, redacted report containing issue type, title, description, and optional diagnostics/logs. The user explicitly copies this report and sends it through the approved beta support channel.

The UI never claims a report was submitted, uploaded, queued, or assigned a server reference.

## Diagnostic snapshot

The support payload may include:

- App version, environment, release channel, build date, and commit placeholder
- Operating system/platform, Electron version, language, online state, and user agent
- Mock/Supabase data-source mode
- Supabase hostname presence only, never keys or full private configuration
- Auth state as `authenticated` or `signed_out`, never session/token data
- Active view, community ID, and channel ID
- Realtime and LiveKit configuration/status summaries
- Most recent redacted API/network/auth/storage/realtime error summary
- Recent redacted logs only when the user opts in

## Redaction boundary

Logging and diagnostics redact sensitive key names, bearer values, JWT-shaped values, authorization headers, passwords, cookies, session material, Supabase service-role keys, LiveKit secrets, API/private/signing keys, and oversized strings.

Users should still inspect exports before sharing them. A redaction failure is a security blocker.

## Logs viewer

Settings > Diagnostics provides recent local logs with level, source, and text filters. Users may copy one selected entry, export the redacted log set, or clear local logs. No provider receives logs automatically.

## Testing

1. Open Settings > Diagnostics and refresh the snapshot.
2. Confirm the Auth card shows only `authenticated` or `signed_out`.
3. Copy/export diagnostics and inspect the JSON.
4. Open Report Issue, complete required fields, toggle diagnostics/log inclusion, and copy the report.
5. Verify the UI says no report was sent.
6. Seed a test log containing fake token/password patterns and run the redaction smoke tests.

