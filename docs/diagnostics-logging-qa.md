# Diagnostics and Logging QA

Picom diagnostics are designed for beta support without exposing secrets.

## Diagnostics payload

Support diagnostics include:

- app name
- app identifier
- app version
- app environment
- release channel
- data source mode
- runtime target
- platform
- language
- online state
- realtime status
- last API/Supabase/network error summary
- optional recent redacted logs

## Redaction rules

Logs and exported diagnostics must not include:

- passwords
- auth tokens
- authorization headers
- cookies
- Supabase service-role keys
- LiveKit API secrets
- signing keys
- access tokens
- refresh tokens

## Commands

```powershell
npm run diagnostics:smoke
npm run typecheck
```

## Manual QA

- Open Settings > Advanced.
- Enable diagnostics and recent redacted logs.
- Export diagnostics JSON.
- Confirm the payload includes app/runtime/service status.
- Confirm the payload does not include passwords, tokens, cookies, service-role keys, LiveKit secrets, or signing keys.
