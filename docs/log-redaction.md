# Picom Log Redaction

## Current client behavior

- Central `loggingService` owns renderer support logs.
- Maximum in-memory entries: 250.
- Levels: debug, info, warn, error.
- Messages and metadata are redacted before storage/listener/export.
- Export and inclusion in feedback are explicit user actions.
- User-facing errors use safe codes/messages while developer context remains redacted.

## Sensitive keys

Object fields matching password, passcode, token, cookie, authorization, secret, session, JWT, API key, service role, LiveKit, Supabase, signing, private key, access token, or refresh token are replaced with `[redacted]`.

String patterns redact:

- Bearer credentials.
- JWT-shaped values.
- Common `password=`, `token=`, `secret=`, `authorization=`, `cookie=`, `api_key=`, `service_role=`, `livekit_secret=`, `signing_key=`, access/refresh/session key-value forms.
- Overlong strings are truncated.

## Never log

- Message/attachment content or signed attachment URLs.
- Passwords, MFA/recovery codes, session/refresh/access tokens, cookies, auth headers.
- Supabase service-role/access tokens or database passwords/URLs.
- LiveKit API key/secret or participant room tokens.
- OAuth client secrets/codes.
- Signing/notarization certificates, private keys, passwords, Apple credentials.
- Screen thumbnails/frames/content, audio, device IDs, raw IP/location, or unnecessary personal data.

## Safe context examples

- Typed public error code.
- Timestamp, app version/channel, platform, environment/data-source label.
- Safe request/log ID and service/source label.
- Connectivity/realtime/voice configured state.
- Community/channel/message IDs only when necessary and access-controlled; avoid names/content.

## Backend/provider logs

Supabase/LiveKit/CI logs must follow the same principles. Disable environment dumps, redact bearer headers/provider responses, restrict dashboard access, configure retention, and avoid copying raw provider logs into public issues.

## Regression testing

Run:

```powershell
npm run logs:smoke
npm run diagnostics:smoke
npm run settings:diagnostics:smoke
npm run secrets:smoke
```

Add fixtures when a new sensitive field/provider is introduced. Use obvious fake values only; never test with a real secret.

## Suspected redaction failure

1. Stop export/sharing and restrict existing copies.
2. Identify the field/pattern without propagating the value.
3. Rotate/revoke exposed credentials.
4. Patch redaction and add a fake regression fixture.
5. Rebuild/retest and follow incident/postmortem policy.
