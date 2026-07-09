# Picom Diagnostics Export

## User workflow

1. Open **Settings > Advanced/Diagnostics**.
2. Select **Refresh** to capture the current safe snapshot.
3. Review the visible fields.
4. Select **Copy diagnostics** or **Export diagnostics**.
5. Inspect the JSON before sending it through the approved support channel.

Export is explicit and local. Picom does not automatically upload diagnostics in Full MVP.

## Snapshot fields

- App name/identifier/version/environment/release channel.
- Build date/commit placeholder, data source, and Electron runtime target.
- Platform, Electron version, language, online state, window width/height, and focus state.
- Auth signed-in/signed-out state.
- Supabase host/environment label without credentials.
- LiveKit configured/not-configured status without URL secret/token.
- Realtime status.
- Active view/community/channel IDs for reproduction context.
- Last safe API-related error summary/log ID/timestamp/source where available.
- Recent redacted logs only when the user explicitly enables them.
- Structured feedback fields only when the user supplies them.

## Excluded data

- Passwords/passcodes.
- Access/refresh/session/JWT/LiveKit tokens.
- Authorization headers and cookies.
- Supabase service-role/access tokens and database credentials.
- LiveKit API key/secret.
- OAuth client secrets.
- Signing/notarization credentials/private keys.
- Message bodies, attachment contents, signed URLs, screen/audio content, and unnecessary personal data.

## Redaction and limits

`loggingService` redacts sensitive key names, bearer/JWT patterns, key-value secrets, and circular structures. Strings are truncated and the in-memory log buffer is bounded. Redaction is defense in depth, not a guarantee for arbitrary user-entered content; users/operators must inspect the export before sharing.

## Support request minimum

Support should request only:

- App version/channel and artifact hash if available.
- Windows/Linux/macOS version and architecture.
- Data source/environment label.
- Reproduction steps, expected/actual result, category/severity.
- Timestamp/timezone and safe request/log ID.
- Optional redacted diagnostics when needed.

Never ask a user to send `.env` files, passwords, tokens, provider dashboards, private keys, raw private messages, or sensitive screen recordings.

## Handling exported files

- Treat as support-confidential even after redaction.
- Store only in the approved support location with least privilege.
- Do not attach to public issues by default.
- Remove when the issue/retention policy permits.
- If a secret is found, stop sharing, restrict/delete copies, rotate the secret, and open a security incident.
