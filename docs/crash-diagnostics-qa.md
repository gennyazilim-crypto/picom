# Crash Diagnostics QA

Picom's renderer crash boundary should help recover from startup failures without exposing secrets.

## Core files

- `src/components/DesktopStartupErrorBoundary.tsx`
- `src/services/crashRecoveryService.ts`
- `src/services/diagnosticsService.ts`
- `src/services/loggingService.ts`

## Crash payload

Copied diagnostics include:

- last crash timestamp
- safe user-facing message
- log id
- app/runtime diagnostics snapshot
- realtime status
- last API error summary
- recent redacted logs

The payload must not include passwords, tokens, cookies, authorization headers, Supabase service-role keys, LiveKit API secrets, or signing keys.

## Commands

```powershell
npm run crash:smoke
npm run diagnostics:smoke
npm run typecheck
```

## Manual QA

- Trigger a renderer error in development.
- Confirm the application error screen appears.
- Click Copy diagnostics.
- Paste into a local scratch file.
- Confirm diagnostics are useful and redacted.
- Click Clear recovery state and restart normally.
