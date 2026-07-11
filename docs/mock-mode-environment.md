# Task 073 - Mock mode environment setting

Picom uses `VITE_DATA_SOURCE` to decide how the desktop app loads data.

## Supported values

- `mock`: explicit local MVP mode. The app uses deterministic typed mock data and does not require Supabase.
- `supabase`: backend mode for Auth, Postgres, RLS, Storage, Realtime, and Edge Functions.

## Runtime config

- `src/config/dataSourcePolicy.ts` accepts only the exact values `mock` and `supabase`.
- Missing or unknown values become an unconfigured Supabase state; fake content is never a fallback.
- `src/services/dataSourceService.ts` is the service-layer authority. Components do not inspect environment variables.
- Mock fixture exports are empty outside explicit mock mode, while deterministic raw fixtures remain available to mock tests.

## Local development

Copy `.env.example` to `.env.local` and keep:

```env
VITE_DATA_SOURCE=mock
```

This keeps the Windows/Linux/macOS Electron desktop shell usable even when backend services are not configured.
