# Supabase Auth email/password configuration

Task 122 configures the local Supabase Auth foundation for Picom email/password sign-in.

## Local config file

- `supabase/config.toml`

The local config enables:

- Supabase Auth.
- Email/password signup.
- Email/password sign-in.
- Refresh token rotation.
- Local Inbucket email testing.
- Local site URL: `http://127.0.0.1:5173`.

## Local development behavior

For local development, email confirmations are disabled:

```toml
enable_confirmations = false
```

This keeps the MVP desktop workflow fast while the UI and API mode are still being wired.

## Production behavior

For staging/production, review these settings in Supabase Dashboard before launch:

- Enable email confirmations when appropriate.
- Configure production site URL and allowed redirect URLs.
- Configure SMTP sender/domain settings. Production Auth From address is `info@picom.gg` (see `docs/password-reset-production.md` and `npm run auth:smtp:sender`).
- Keep refresh token rotation enabled.
- Do not expose service-role keys to the Electron renderer.
- Never log passwords, access tokens, refresh tokens, authorization headers, or magic-link tokens.

## Renderer environment

The Electron renderer may only receive public Supabase values:

```powershell
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_DATA_SOURCE=supabase
```

`VITE_SUPABASE_ANON_KEY` is only safe when RLS policies enforce access. Service role keys must stay server-side only.

## Seed users

Local seed users are documented in `docs/supabase-seed-data.md`. They are development-only and must not be used in production.

## RLS and security notes

Supabase Auth confirms identity. RLS remains the source of truth for data access. Even after sign-in, the client should only access rows allowed by RLS policies.

Session handling should treat expired/revoked sessions as recoverable auth states and should clear local auth UI state without dumping tokens into logs.

## Test steps

1. Install Supabase CLI.
2. Run `supabase start`.
3. Run `supabase db reset` to apply migrations and seed local users.
4. Set `VITE_DATA_SOURCE=supabase`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` in `.env.local`.
5. Start Picom with `npm run dev`.
6. Sign in with a development user from `docs/supabase-seed-data.md` once auth UI wiring is enabled.

## Verification commands

```powershell
npm run supabase:smoke
npm run typecheck
npm run build
```