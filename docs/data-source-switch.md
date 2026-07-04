# Data source switch

Task 142 creates the MVP data source switch for mock mode vs Supabase mode.

## Modes

| Mode | Env value | Purpose |
| --- | --- | --- |
| Mock | `VITE_DATA_SOURCE=mock` | Fully local desktop UI development without backend. |
| Supabase | `VITE_DATA_SOURCE=supabase` | MVP backend mode using Supabase Auth, Postgres, RLS, Storage, Realtime, and later Edge Functions. |

## Service boundary

Use:

```text
src/services/dataSourceService.ts
```

The service exposes:

- `getMode()`
- `getStatus()`
- `getSupabaseConfig()`

UI components should not independently inspect `import.meta.env.VITE_DATA_SOURCE`. They should call data/domain services, and those services should use `dataSourceService`.

## Current wiring

- `supabaseClient` uses `dataSourceService` to decide whether Supabase is enabled and configured.
- `authService` uses `dataSourceService` to keep mock login/register working without a backend.
- Future CRUD services should follow the same pattern.

## Safety behavior

- Mock mode never requires Supabase environment variables.
- Supabase mode fails clearly if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing.
- The Electron renderer must only use the Supabase anon key.
- Service-role keys and backend secrets must never be placed in Vite environment variables.

## Manual test steps

1. Set `VITE_DATA_SOURCE=mock` and run the app; mock login/register should work without Supabase.
2. Set `VITE_DATA_SOURCE=supabase` without Supabase env values; the app should show a clear configuration error instead of silently falling back.
3. Set valid Supabase values; Auth should use Supabase mode.
4. Run `npm run typecheck` and `npm run build`.