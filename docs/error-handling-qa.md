# Error Handling QA

Picom uses a small unified error taxonomy for user-facing messages.

## Goals

- Keep technical provider errors out of normal UI.
- Keep diagnostics/logs useful for developers.
- Avoid exposing passwords, tokens, cookies, authorization headers, Supabase service-role keys, LiveKit secrets, or signing keys.

## Core files

- `src/services/errorCodes.ts`
- `src/services/loggingService.ts`
- `src/services/logging/loggingService.ts`

## Supported MVP error categories

- auth failures
- validation errors
- rate limits
- network/backend unavailable
- Supabase unavailable
- realtime unavailable
- upload size/type failures
- voice placeholder failures
- native desktop action unavailable

## Commands

```powershell
npm run errors:smoke
npm run typecheck
```

## Manual QA

- Trigger a bad login.
- Trigger an invalid upload.
- Disable Supabase env in Supabase mode.
- Confirm the user sees friendly copy.
- Confirm technical details remain in redacted diagnostics/logs only.
