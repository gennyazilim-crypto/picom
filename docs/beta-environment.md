# Beta Environment Config

Task 276 defines the safe beta environment configuration for Picom desktop smoke testing.

## Purpose

The beta environment is used to test the Windows, Linux, and macOS Electron app against beta Supabase and LiveKit services without committing production secrets.

## Files

- `.env.example` remains the local development template.
- `.env.beta.example` is the beta smoke-test template.
- `.env.local` is the local, uncommitted file used by Vite/Electron during development.

## Beta values

Use these values as the shape for beta testing:

```bash
VITE_APP_ENV=beta
VITE_RELEASE_CHANNEL=beta
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=https://YOUR_BETA_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_BETA_SUPABASE_ANON_KEY
VITE_LIVEKIT_URL=wss://YOUR_BETA_LIVEKIT_HOST
```

## Secret rules

- Do not commit `.env.local`.
- Do not put Supabase service-role keys in Vite env variables.
- Do not put LiveKit API keys or secrets in Vite env variables.
- Do not put database passwords, JWT secrets, signing keys, or auth tokens in renderer-visible variables.
- Supabase anon keys are acceptable only when RLS policies are enabled and tested.

## Manual beta smoke setup

1. Copy `.env.beta.example` to `.env.local`.
2. Replace placeholder Supabase and LiveKit public values.
3. Run `npm run typecheck`.
4. Run `npm run build`.
5. Run `npm run dev`.
6. Confirm the app starts in Supabase mode without exposing secrets in the renderer console.
