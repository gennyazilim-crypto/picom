# Migration SQL review

File: `supabase/migrations/20260816000000_reconcile_account_onboarding_rpc_contract.sql`  
Fingerprint: PASS

## Intended work

Additive reconciliation of the callable onboarding RPC. Historical migrations are not rewritten. No profile row UPDATE/DELETE/TRUNCATE. No auth/RLS/feature-flag/client-config changes.

## Every statement the migration will execute

1. `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_start_choice text;`
2. `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_initial_feed text;`
3. `ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_onboarding_start_choice_check;`
4. `ALTER TABLE public.profiles ADD CONSTRAINT profiles_onboarding_start_choice_check CHECK (onboarding_start_choice is null or onboarding_start_choice in ('createCommunity', 'joinInvite', 'mentionFeed')) NOT VALID;`
5. `ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_onboarding_initial_feed_check;`
6. `ALTER TABLE public.profiles ADD CONSTRAINT profiles_onboarding_initial_feed_check CHECK (onboarding_initial_feed is null or onboarding_initial_feed in ('mention', 'community', 'invite')) NOT VALID;`
7. `DROP FUNCTION IF EXISTS public.complete_current_user_onboarding(jsonb, uuid[], text);`
8. `DROP FUNCTION IF EXISTS public.complete_current_user_onboarding(jsonb, uuid[], text, text);`
9. `DROP FUNCTION IF EXISTS public.complete_current_user_onboarding(jsonb, uuid[], text, text, text);`
10. `CREATE FUNCTION public.complete_current_user_onboarding(...)` — 5 args, SECURITY DEFINER, `search_path = pg_catalog, public, extensions`, actor from `auth.uid()` only
11. `REVOKE ALL ... FROM public, anon, service_role;`
12. `GRANT EXECUTE ... TO authenticated;`
13. `COMMENT ON COLUMN` start_choice
14. `COMMENT ON COLUMN` initial_feed
15. `COMMENT ON FUNCTION` 5-arg

## Security properties vs requirements

| Requirement | Migration |
|---|---|
| SECURITY DEFINER | yes |
| safe explicit search_path | `pg_catalog, public, extensions` |
| current user from `auth.uid()` | yes; raises AUTH_REQUIRED if null |
| no arbitrary target user argument | no `target_user_id` / `user_id` / `profile_id` |
| authenticated-only | GRANT authenticated; REVOKE public, anon, service_role |
| failure transactional | single PL/pgSQL function; exceptions abort the call |
| duplicate completion safe | `onboarding_completed_at = coalesce(existing, now())` |
| completion timestamp preserved | yes via coalesce |

## Out of scope found

None. STOP not required for SQL scope.
