-- T91 k-anonymity suppression for marts + T72 trend detection. Applied to piso prod 2026-07-15.
-- Additive, non-destructive (new function/table; reads daily_metrics/community_metrics, only
-- inserts into the new metric_trend_signals table).
-- Rollback: drop function detect_metric_trends(integer,numeric); drop table metric_trend_signals;
--           drop function get_community_metrics_kanon(integer); drop function k_suppress(numeric,integer,integer);

create or replace function public.k_suppress(value numeric, cohort_size integer, min_k integer default 5)
returns numeric language sql immutable
as $function$ select case when cohort_size is null or cohort_size < min_k then null else value end $function$;

create or replace function public.get_community_metrics_kanon(min_k integer default 5)
returns table(community_id uuid, date date, active_members integer,
  messages_count numeric, posts_count numeric, voice_minutes numeric)
language sql stable security definer set search_path to 'public'
as $function$
  select cm.community_id, cm.date,
    (public.k_suppress(cm.active_members, cm.active_members, min_k))::integer,
    public.k_suppress(cm.messages_count, cm.active_members, min_k),
    public.k_suppress(cm.posts_count, cm.active_members, min_k),
    public.k_suppress(cm.voice_minutes, cm.active_members, min_k)
  from public.community_metrics cm;
$function$;
revoke all on function public.get_community_metrics_kanon(integer) from public;
revoke all on function public.get_community_metrics_kanon(integer) from anon;
revoke all on function public.get_community_metrics_kanon(integer) from authenticated;
grant execute on function public.get_community_metrics_kanon(integer) to service_role;

create table if not exists public.metric_trend_signals (
  id uuid primary key default gen_random_uuid(),
  metric_name text not null,
  observed numeric not null,
  baseline_mean numeric,
  baseline_stddev numeric,
  zscore numeric,
  direction text,
  detected_at timestamptz not null default now()
);
create index if not exists metric_trend_signals_detected_idx on public.metric_trend_signals (detected_at desc);
alter table public.metric_trend_signals enable row level security;
create policy "trend signals admin read" on public.metric_trend_signals for select using (public.is_app_admin());

create or replace function public.detect_metric_trends(lookback_days integer default 14, z_threshold numeric default 2.0)
returns setof public.metric_trend_signals
language plpgsql security definer set search_path to 'public'
as $function$
declare r record;
begin
  for r in
    with agg as (
      select metric_name, date, sum(metric_value) as v
      from public.daily_metrics
      where date >= current_date - greatest(lookback_days,2)
      group by metric_name, date
    ), stats as (
      select metric_name,
        avg(v) filter (where date < current_date) as mean,
        stddev_pop(v) filter (where date < current_date) as sd,
        max(v) filter (where date = current_date) as today
      from agg group by metric_name
    )
    select metric_name, today, mean, sd,
      case when sd is null or sd = 0 then 0 else (today - mean)/sd end as z
    from stats where today is not null
  loop
    if r.z is not null and abs(r.z) >= z_threshold then
      insert into public.metric_trend_signals(metric_name, observed, baseline_mean, baseline_stddev, zscore, direction)
      values (r.metric_name, r.today, r.mean, r.sd, r.z, case when r.z > 0 then 'up' else 'down' end);
    end if;
  end loop;
  return query select * from public.metric_trend_signals where detected_at >= now() - interval '1 minute' order by detected_at desc;
end;
$function$;
revoke all on function public.detect_metric_trends(integer, numeric) from public;
revoke all on function public.detect_metric_trends(integer, numeric) from anon;
revoke all on function public.detect_metric_trends(integer, numeric) from authenticated;
grant execute on function public.detect_metric_trends(integer, numeric) to service_role;
