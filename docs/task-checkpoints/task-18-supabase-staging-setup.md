# Task 18 - Supabase Staging Setup

## Status

Prepared the staging runbook and secret-safe environment examples. No remote Supabase project was changed by this task.

## Delivered

- End-to-end Supabase staging project checklist.
- Migration, Auth, Storage, Realtime, Edge Function, type generation, seed, and RLS smoke commands.
- Renderer/public versus Edge/server secret boundary.
- `picom://auth/callback` local Supabase config allowlist.
- Server-only `supabase/.env.example` with empty placeholders.
- CLI-only access token/project-ref placeholders and safe `supabase:status`, `supabase:db:push`, and LiveKit-token deploy scripts.

## Manual work remaining

- Install/authenticate Supabase CLI if missing.
- Create and link the real staging project.
- Apply migrations and verify RLS with staging identities.
- Configure Google/Apple providers.
- Set Edge Function secrets and deploy functions.
- Run two-window realtime, Storage, invite, and voice smoke tests.

## Validation

- `npm run typecheck`
- `npm run build`
- `npm run supabase:smoke` performs static checks and reports CLI availability honestly.
