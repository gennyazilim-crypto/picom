# Task 28 Checkpoint: Supabase Production Project Setup

## Scope

- Added a production Supabase setup runbook covering region, Auth, redirects, email, migrations, RLS, Storage, Realtime, Edge Functions, backups, and admin access.
- Added a production environment inventory with empty/obvious placeholders only.
- Added a production environment release checklist.
- Expanded Git ignore rules for real production and environment-local files.

## Security boundaries

- Renderer-safe public values are separated from CI/operator and Edge Function secrets.
- Service-role, Supabase access token, database password, and LiveKit secrets are never renderer variables.
- No remote project was created, linked, mutated, or deployed in this task.
- No real credential was added.

## Validation

- `npm run env:smoke` - passed.
- `npm run secrets:smoke` - passed.
- `npm run secrets:ci:smoke` - passed.
- `npm run supabase:smoke` - passed structurally; Supabase CLI is unavailable for remote/local reset checks.
- `npm run typecheck` - passed.
- `npm run mock:smoke` - passed.
- `npm run build` - passed with the known non-blocking chunk warning.

## External work remaining

- Create/approve the production organization/project and region.
- Configure real values only in the approved CI/secret stores.
- Execute migrations and policy tests with authorized operators.
- Record backup, restore, access-review, monitoring, and rollback evidence.
