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

## Final local, staging, and production contract

| Target | Source example | Data source | Required public values |
| --- | --- | --- | --- |
| Local UI | `.env.example` | `mock` by default | None |
| Staging/beta | `.env.beta.example` | `supabase` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Production | `.env.production.example` | `supabase` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

Run `npm run supabase:env:validate` before a release. Validate a populated ignored file with
`node scripts/validate-supabase-environment.mjs --target staging --file .env.staging.local` or the
equivalent `production` command. Missing required values, invalid/insecure URLs, credential-bearing
URLs, server-only names under `VITE_`, and tracked real env files fail with a specific error.

Only the Supabase URL and anon/publishable key are renderer-safe, and only with tested RLS. A
service-role or `sb_secret_` key is never renderer-safe. `supabase/functions/.env.example` documents
the empty server-only placeholder; deployed values belong in Supabase Function secrets or an approved
secret manager and must never be copied into the Electron renderer environment.

Also run `npm run env:smoke`, `npm run env:placeholders:check`, and `npm run secrets:smoke`. These
repository checks do not prove hosted credentials, remote project reachability, or RLS correctness;
those remain staging deployment gates.
