# Supabase environment, migrations, and types

Status date: 2026-07-11

## Canonical runtime architecture

- The Electron renderer has one client factory: `src/services/supabase/supabaseClient.ts`.
- Renderer-safe Supabase values are read once by `src/config/appConfig.ts` and validated by `dataSourceService` according to `VITE_DATA_SOURCE`.
- Services receive the typed client through `getSupabaseClient()`; components do not construct clients.
- Edge Functions may create request-scoped anon or server-role clients because they are isolated server runtimes. Those clients are not renderer duplicates, and server-role values must remain Edge secrets.
- `webhookService` now derives its public function endpoint from `appConfig` rather than reading Vite env directly.

## Environment contract

| Mode | Data source | Required renderer values | Rule |
| --- | --- | --- | --- |
| Local UI | `mock` | none | Supabase absence must not block desktop UI work. |
| Local backend | `supabase` | local URL and anon key | HTTP is accepted only for localhost/127.0.0.1. |
| Staging/Beta | `supabase` | HTTPS URL and anon/publishable key | Real ignored env file; placeholders are rejected. |
| Production | `supabase` | HTTPS URL and anon/publishable key | Protected release configuration only. |

All `VITE_` values are public renderer configuration. Never place a service-role key, database password, PAT, JWT secret, LiveKit secret, signing key, or access token in them.

Validate examples or a real ignored file:

```powershell
node scripts/validate-supabase-environment.mjs
node scripts/validate-supabase-environment.mjs --target staging --file .env.staging.local
node scripts/validate-supabase-environment.mjs --target production --file .env.production.local
```

## Migration contract

`npm run supabase:migrations:check` enforces:

- unique 14-digit migration prefixes;
- strict filename ordering;
- no UTF-8 BOM or merge markers;
- the ordered Full MVP chain for community kinds, Radio, Podcast, Friends, DM, Profile, Feed, Settings, role/admin structure, and Voice authorization.

The current static audit found 159 uniquely ordered, BOM-free migrations. Static checks do not prove SQL execution or RLS behavior. Only a clean local reset or reviewed staging dry run proves the full chain applies.

Local execution:

```powershell
npm run supabase:cli:check -- --require
supabase start
npm run supabase:migrations:check
supabase db reset
npm run supabase:rls:test
npm run supabase:types
npm run typecheck
```

Staging review (never production by accident):

```powershell
node scripts/validate-supabase-environment.mjs --target staging --file .env.staging.local
supabase link --project-ref $env:SUPABASE_PROJECT_REF
supabase migration list --linked
supabase db push --dry-run
npm run supabase:types -- --linked
npm run supabase:types:check -- --linked
```

Production migration requires a backup verification, reviewed migration inventory, rollback/forward-fix decision, protected operator approval, and an explicit target check. Never run `db reset` against staging or production.

## Atomic type generation

`scripts/generate-supabase-types.mjs` runs the CLI without shell redirection. It validates the output and atomically replaces `database.types.ts` only on success.

```powershell
# Applied local schema (default)
npm run supabase:types
npm run supabase:types:check

# Already linked reviewed staging project
npm run supabase:types -- --linked
npm run supabase:types:check -- --linked

# Explicit reviewed project ref
npm run supabase:types -- --project-id $env:SUPABASE_PROJECT_REF
```

The project ref is not printed. CLI authentication remains outside the repository and must use the operator's secure credential store.

## Current type evidence

The committed type snapshot is aligned for renderer-facing Full MVP tables and the current type-aware LiveKit authorization/moderation RPCs. The static audit found the file is not a complete CLI-generated representation of every internal table and helper function: migrations define 102 tables and 319 functions, while the committed snapshot currently declares 87 tables and 125 functions. Most missing functions are trigger/security helpers not called by the renderer, but this is still a generation gap.

Full regeneration is **BLOCKED** in this environment because the Supabase CLI and an applied local/linked schema are unavailable. The committed file was not replaced with guessed types. Run the atomic generator after `db reset` or against reviewed staging, inspect the diff, run typecheck/QA, and commit the generated snapshot before claiming full schema parity.

## Required checks

```powershell
npm run supabase:config:smoke
npm run supabase:migrations:check
npm run supabase:smoke
npm run supabase:qa
npm run typecheck
npm run mock:smoke
npm run build
npm run qa:smoke
```
