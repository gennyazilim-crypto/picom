# Task 103 - Supabase client configuration

Picom now includes the official Supabase JavaScript client for future API mode work.

## Dependency

- `@supabase/supabase-js`

## Runtime path

- `src/services/supabase/supabaseClient.ts`

## Safety behavior

- Mock mode does not create a Supabase client.
- Supabase mode requires both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Missing config returns `null` instead of crashing the desktop renderer.
- Renderer code only uses anon-key configuration.
- Service-role keys must never be placed in Vite env variables.
- `detectSessionInUrl` is disabled for the desktop renderer to avoid web redirect assumptions.

## Local setup

```env
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Keep UI-only development on:

```env
VITE_DATA_SOURCE=mock
```

## Manual verification

1. Run `npm run typecheck`.
2. Run `npm run build`.
3. Keep `.env.local` in mock mode and confirm the app still runs without Supabase.
4. Switch to Supabase mode only after the database schema and RLS tasks are completed.
