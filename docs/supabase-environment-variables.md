# Supabase environment variables

Picom uses Vite renderer environment variables for Supabase anon-client configuration only.

## Renderer-safe variables

```env
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

These values are visible to the Electron renderer bundle. They are safe only when Supabase RLS policies are enabled and tested.

## Mock mode variables

```env
VITE_DATA_SOURCE=mock
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Mock mode must remain the default local UI path until Supabase schema and RLS tasks are complete.

## Variables intentionally not included

Do not add these to `.env.example`, `.env.local`, or any Vite renderer env file:

- `SUPABASE_SERVICE_ROLE_KEY`
- Database passwords
- JWT signing secrets
- SMTP credentials
- LiveKit API secrets
- Storage provider private keys

Privileged operations belong in Supabase Edge Functions or a trusted backend, not in the renderer.

## Data source behavior

- `VITE_DATA_SOURCE=mock`: app uses local typed mock data.
- `VITE_DATA_SOURCE=supabase`: app may create a Supabase client if URL and anon key are present.
- Unknown values normalize to mock mode.

## Verification

1. Copy `.env.example` to `.env.local`.
2. Keep `VITE_DATA_SOURCE=mock` and run `npm run dev` for UI work.
3. Set `VITE_DATA_SOURCE=supabase` only when schema/RLS is ready.
4. Run `npm run typecheck` and `npm run build` after env config changes.
