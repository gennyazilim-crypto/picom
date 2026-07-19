-- T90 — deletion propagation completeness. Applied to piso prod 2026-07-15. Additive + targeted.
--
-- Gap: on profile deletion, feed_events is ON DELETE CASCADE (removed) and
-- analytics_events is anonymized by the existing AFTER trigger, but search_query_logs kept its
-- raw `query` text (FK only SET NULL on user_id). This adds a BEFORE-delete trigger that
-- redacts the raw query text for the deleting user (scoped to old.id — not a mass update; runs
-- only during an actual account deletion), plus a read-only completeness checker.
-- Security tables (security_events/audit/rate_limit/risk_scores) are intentionally retained
-- under their own legitimate-interest/legal retention, not anonymized here.
-- Rollback: drop trigger profiles_redact_pii_before_delete on public.profiles;
--           drop function redact_pii_before_profile_delete(); drop function deletion_propagation_status(uuid);
create or replace function public.redact_pii_before_profile_delete()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  update public.search_query_logs set query = '[redacted]'
    where user_id = old.id and query <> '[redacted]';
  return old;
end;
$function$;
drop trigger if exists profiles_redact_pii_before_delete on public.profiles;
create trigger profiles_redact_pii_before_delete
  before delete on public.profiles
  for each row execute function public.redact_pii_before_profile_delete();

create or replace function public.deletion_propagation_status(target uuid)
returns table(surface text, residual_rows bigint)
language sql stable security definer set search_path to 'public'
as $function$
  select 'analytics_events.actor'::text, count(*)::bigint from public.analytics_events where actor_user_id = target
  union all
  select 'feed_events'::text, count(*)::bigint from public.feed_events where user_id = target
  union all
  select 'search_query_logs.query_kept'::text, count(*)::bigint from public.search_query_logs where user_id = target and query <> '[redacted]';
$function$;
revoke all on function public.deletion_propagation_status(uuid) from public;
revoke all on function public.deletion_propagation_status(uuid) from anon;
revoke all on function public.deletion_propagation_status(uuid) from authenticated;
grant execute on function public.deletion_propagation_status(uuid) to service_role;
