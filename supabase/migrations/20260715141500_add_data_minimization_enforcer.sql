-- T56 — data minimization enforcer. Additive DEFINITION, but the function performs an
-- IRREVERSIBLE bulk modification of historical production data when RUN.
--
-- STATUS: NOT APPLIED / NOT SCHEDULED. The auto-mode safety classifier correctly flags a
-- recurring mass-UPDATE that nulls actor_user_id and redacts query text across whole tables by
-- time cutoff only — this cannot be undone. Review the retention window and enable deliberately:
--   1) apply this migration (creates the function only — no data change yet),
--   2) dry-run intent: SELECT count(*) FROM analytics_events WHERE actor_user_id IS NOT NULL
--        AND created_at < now() - interval '180 days';
--   3) run once manually: SELECT public.enforce_analytics_minimization(180);
--   4) optionally schedule weekly:
--        SELECT cron.schedule('analytics-minimization','30 3 * * 0',
--          $$select public.enforce_analytics_minimization(180);$$);
--
-- Rationale: aggregate metrics already live in daily_metrics, so identifiable linkage in raw
-- analytics_events / raw search query text can be dropped past the retention window.

create or replace function public.enforce_analytics_minimization(retention_days integer default 180)
returns table(surface text, minimized bigint)
language plpgsql security definer set search_path to 'public'
as $function$
declare cutoff timestamptz := now() - make_interval(days => greatest(retention_days, 1)); n1 bigint; n2 bigint;
begin
  update public.analytics_events
    set actor_user_id = null,
        metadata = metadata || jsonb_build_object('minimized', true)
    where actor_user_id is not null and created_at < cutoff;
  get diagnostics n1 = row_count;

  update public.search_query_logs
    set query = '[redacted]'
    where query <> '[redacted]' and created_at < cutoff;
  get diagnostics n2 = row_count;

  return query values ('analytics_events.actor', n1), ('search_query_logs.query', n2);
end;
$function$;
revoke all on function public.enforce_analytics_minimization(integer) from public;
revoke all on function public.enforce_analytics_minimization(integer) from anon;
revoke all on function public.enforce_analytics_minimization(integer) from authenticated;
grant execute on function public.enforce_analytics_minimization(integer) to service_role;
