-- T60 — analytics data quality monitoring. Applied to live "piso" (Picom prod) 2026-07-15.
-- Additive: new table `analytics_data_quality_runs` + `run_analytics_data_quality()`.
-- Runner is service_role-only (least privilege); admins read results via RLS (public.is_app_admin()).
-- Checks: freshness, 24h volume, queue backlog, stuck queue rows, invalid consent category.
--
-- First run on prod surfaced a real issue: freshness ~8637 min (~6 days) and 0 events in 24h,
-- with 542 queue rows pending / 0 processed -> process_analytics_event_queue is not being
-- invoked on a schedule. Fix (operator): schedule the queue processor (pg_cron or an Edge
-- Function cron) and, optionally, schedule run_analytics_data_quality() for ongoing checks.

create table if not exists public.analytics_data_quality_runs (
  id uuid primary key default gen_random_uuid(),
  check_name text not null,
  status text not null check (status in ('ok','warn','fail')),
  observed numeric,
  threshold numeric,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);
create index if not exists analytics_dq_runs_checked_at_idx on public.analytics_data_quality_runs (checked_at desc);
create index if not exists analytics_dq_runs_check_idx on public.analytics_data_quality_runs (check_name, checked_at desc);

alter table public.analytics_data_quality_runs enable row level security;
create policy "dq runs admin read" on public.analytics_data_quality_runs
  for select using (public.is_app_admin());

create or replace function public.run_analytics_data_quality()
returns setof public.analytics_data_quality_runs
language plpgsql security definer set search_path to 'public'
as $function$
declare v_fresh numeric; v_vol numeric; v_backlog numeric; v_stuck numeric; v_badconsent numeric;
begin
  select extract(epoch from (now()-max(created_at)))/60 into v_fresh from public.analytics_events;
  insert into public.analytics_data_quality_runs(check_name,status,observed,threshold,details)
  values ('freshness_minutes', case when v_fresh is null then 'warn' when v_fresh>180 then 'fail' when v_fresh>60 then 'warn' else 'ok' end, v_fresh, 180, jsonb_build_object('unit','minutes'));

  select count(*) into v_vol from public.analytics_events where created_at >= now()-interval '24 hours';
  insert into public.analytics_data_quality_runs(check_name,status,observed,threshold,details)
  values ('events_last_24h', case when v_vol=0 then 'warn' else 'ok' end, v_vol, 1, '{}'::jsonb);

  select count(*) into v_backlog from public.analytics_event_queue where status='pending';
  insert into public.analytics_data_quality_runs(check_name,status,observed,threshold,details)
  values ('queue_backlog_pending', case when v_backlog>5000 then 'fail' when v_backlog>1000 then 'warn' else 'ok' end, v_backlog, 1000, '{}'::jsonb);

  select count(*) into v_stuck from public.analytics_event_queue where status<>'processed' and attempts>=3;
  insert into public.analytics_data_quality_runs(check_name,status,observed,threshold,details)
  values ('queue_stuck_rows', case when v_stuck>0 then 'warn' else 'ok' end, v_stuck, 0, '{}'::jsonb);

  select count(*) into v_badconsent from public.analytics_events where consent_category not in ('necessary','analytics','ads');
  insert into public.analytics_data_quality_runs(check_name,status,observed,threshold,details)
  values ('invalid_consent_category', case when v_badconsent>0 then 'fail' else 'ok' end, v_badconsent, 0, '{}'::jsonb);

  return query select * from public.analytics_data_quality_runs where checked_at >= now()-interval '1 minute' order by checked_at desc;
end;
$function$;

revoke all on function public.run_analytics_data_quality() from public;
revoke all on function public.run_analytics_data_quality() from anon;
revoke all on function public.run_analytics_data_quality() from authenticated;
grant execute on function public.run_analytics_data_quality() to service_role;

-- Rollback: drop function run_analytics_data_quality(); drop table analytics_data_quality_runs;
