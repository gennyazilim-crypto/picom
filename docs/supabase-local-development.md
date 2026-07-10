# Supabase local development notes

These notes describe how Picom developers should work locally while Supabase backend tasks are still being built.

## Recommended default

Use mock mode for normal desktop UI development:

```env
VITE_DATA_SOURCE=mock
```

This keeps the Electron app usable without running Supabase locally.

## When to use Supabase mode

Use Supabase mode only when working on backend integration tasks:

```env
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=local-anon-key-from-supabase-status
```

The exact local URL and anon key should come from the local Supabase CLI output.

## CLI prerequisites and installation

The Supabase CLI npm path requires Node.js 20 or later. Local services also require Docker Desktop or
another Docker-compatible container runtime. Prefer a project dev dependency so contributors use a
reviewed version:

```powershell
npm install supabase --save-dev
npx supabase --version
```

Installing the dependency changes `package.json` and the lockfile and should be reviewed as a normal
dependency update. A contributor may instead use an officially supported platform installer. Run
`npm run supabase:cli:check` to detect availability without blocking UI development; add `-- --require`
in database CI where absence must fail.

Official references:

- <https://supabase.com/docs/guides/local-development/cli/getting-started>
- <https://supabase.com/docs/guides/local-development/overview>

## Local reset, migrate, and seed workflow

The committed `supabase/` directory is already the project scaffold. From the Picom repository root:

```powershell
npx supabase start
npx supabase status
npx supabase db reset
npx supabase migration up --local
npm run supabase:rls:test
```

`db reset` recreates the local database, applies `supabase/migrations` in order, and applies configured
seed data. It is the normal clean-state migrate/seed command. `migration up --local` applies pending
migrations without a full reset. Use `npx supabase stop` when finished. Never run destructive reset or
down commands against staging or production. Linking and `db push` require a reviewed deployment step,
backup verification, and the correct project ref.

## Renderer safety

The Electron renderer may only use the anon key.

Never expose:

- service-role key
- database password
- JWT secret
- storage provider private keys
- LiveKit API secrets

## RLS local testing

For every table exposed to the renderer:

1. Enable RLS.
2. Add policies before UI wiring.
3. Test as an allowed member.
4. Test as a non-member.
5. Test private channel denial.
6. Confirm denied queries fail cleanly and do not leak data.

Real local execution is:

```powershell
npx supabase start
npx supabase db reset
npm run supabase:rls:test
```

`npm run supabase:rls:smoke` is structural only and remains safe when the CLI is absent.

## Hosted-only fallback when CLI/Docker is unavailable

1. Keep desktop UI work in `VITE_DATA_SOURCE=mock`; CLI absence must not block `npm run dev`,
   `npm run mock:smoke`, typecheck, or renderer builds.
2. Use a dedicated staging Supabase project, never production, and verify the target project name/ref.
3. In Dashboard SQL Editor, review and apply committed files from `supabase/migrations` in filename order.
   Record each applied filename/commit. Do not paste unreviewed destructive SQL.
4. Add development-only fixture rows/users manually or with reviewed seed SQL. Never copy production data.
5. Inspect that every exposed `public` table has RLS enabled and expected policies. SQL Editor runs with
   privileged access, so successful SQL Editor queries do **not** prove RLS behavior.
6. Configure an ignored staging env with only URL + anon/publishable key, run
   `node scripts/validate-supabase-environment.mjs --target staging --file <env-file>`, then test through
   Picom/the public client.
7. Run the manual RLS matrix below and retain redacted evidence. Mark local pgTAP as not run; never report
   a structural smoke or Dashboard query as a real RLS pass.

### Manual hosted RLS matrix

- Create two ordinary test accounts A and B; do not use service-role credentials.
- A creates/joins community A and sends a public-channel message; B verifies only policy-allowed reads.
- A creates/uses a private channel; B must not list the channel, message, or attachment metadata.
- B attempts message insert/update/delete and membership/role changes in community A; each unauthorized
  operation must be denied without returning private row data.
- A verifies own permitted edit/delete and upload paths; B verifies those objects remain inaccessible.
- Sign out and repeat public/visitor reads with the anon role where public access is intentionally enabled.
- Capture status/error codes and row counts only; redact emails, tokens, authorization headers, and content.

## Local data strategy

- Keep mock data as the desktop UI baseline.
- Supabase seed data should mirror the mock communities enough to test the same UI flows.
- Seed users should use development-only credentials.
- Never copy production data into local development.

## Troubleshooting

- If Supabase is not running, switch back to `VITE_DATA_SOURCE=mock`.
- If URL/key are missing, `getSupabaseClient()` returns `null` instead of crashing.
- If RLS blocks expected data, verify membership/channel policies before changing frontend code.
- If realtime is unavailable, text fetch/send paths should still be tested separately.

## Manual verification

1. Run Picom in mock mode and confirm the desktop UI works.
2. Start local Supabase when available.
3. Switch to Supabase mode with local URL and anon key.
4. Confirm the client is configured without using secrets.
5. Run typecheck/build after changes.
