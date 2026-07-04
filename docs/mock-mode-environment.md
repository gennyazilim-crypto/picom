# Task 073 - Mock mode environment setting

Picom uses `VITE_DATA_SOURCE` to decide how the desktop app loads data.

## Supported values

- `mock`: default local MVP mode. The app uses deterministic typed mock data and does not require Supabase.
- `supabase`: reserved for backend integration tasks.

## Runtime config

- `src/config/appConfig.ts` normalizes unknown values back to `mock`.
- `isMockMode` and `isSupabaseMode` are exported for future data-source wiring.

## Local development

Copy `.env.example` to `.env.local` and keep:

```env
VITE_DATA_SOURCE=mock
```

This keeps the Windows/Linux/macOS Electron desktop shell usable even when backend services are not configured.
