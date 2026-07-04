# Desktop Environment Variables

Picom uses Vite-style `VITE_` variables for renderer-safe desktop configuration.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Keep `VITE_DATA_SOURCE=mock` until Supabase setup tasks are complete.
3. Add only renderer-safe public values to `.env.local`.

## Renderer-safe variables

- `VITE_APP_ENV`
- `VITE_APP_NAME`
- `VITE_APP_IDENTIFIER`
- `VITE_DATA_SOURCE`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_LIVEKIT_URL`
- `VITE_DEV_SERVER_URL`

## Never commit these as renderer variables

- Supabase service role key
- LiveKit API key
- LiveKit API secret
- database passwords
- private tokens
- signing certificates

Privileged values belong in server-side Supabase Edge Function settings or deployment secrets, not in Electron renderer bundles.