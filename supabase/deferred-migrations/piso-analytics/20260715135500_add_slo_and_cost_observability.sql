-- T95 SLO definitions + checker, T96 cost/FinOps ledger + writer. Applied to piso prod 2026-07-15.
-- Additive, non-destructive.
-- Rollback: drop function record_cost_metric(...); drop table cost_metrics;
--           drop function check_slos(integer); drop table slo_definitions;

create table if not exists public.slo_definitions (
  slo_key text primary key,
  service text not null,
  target_pct numeric not null,
  window_days integer not null default 7,
  description text not null default '',
  active boolean not null default true
);
alter table public.slo_definitions enable row level security;
create policy "slo defs admin read" on public.slo_definitions for select using (public.is_app_admin());
insert into public.slo_definitions(slo_key, service, target_pct, window_days, description) values
  ('service_availability', '*', 99.0, 7, 'Overall health-check availability across services')
on conflict (slo_key) do nothing;

create or replace function public.check_slos(window_days integer default 7)
returns table(slo_key text, service text, target_pct numeric, observed_pct numeric, status text)
language sql stable security definer set search_path to 'public'
as $function$
  with overall as (
    select 100.0 * count(*) filter (where status in ('ok','healthy','up','operational'))
           / nullif(count(*),0) as pct
    from public.service_health_logs
    where checked_at >= now() - make_interval(days => greatest(window_days,1))
  )
  select d.slo_key, d.service, d.target_pct, round(o.pct,2),
    case when o.pct is null then 'no_data' when o.pct >= d.target_pct then 'ok' else 'breach' end
  from public.slo_definitions d cross join overall o
  where d.active and d.service = '*';
$function$;
revoke all on function public.check_slos(integer) from public;
revoke all on function public.check_slos(integer) from anon;
revoke all on function public.check_slos(integer) from authenticated;
grant execute on function public.check_slos(integer) to service_role;

create table if not exists public.cost_metrics (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  service text not null,
  category text not null default 'infra',
  amount numeric not null,
  currency text not null default 'USD',
  source text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists cost_metrics_date_idx on public.cost_metrics (date desc);
alter table public.cost_metrics enable row level security;
create policy "cost metrics admin read" on public.cost_metrics for select using (public.is_app_admin());

create or replace function public.record_cost_metric(
  date_input date, service_input text, amount_input numeric,
  category_input text default 'infra', currency_input text default 'USD',
  source_input text default 'manual', metadata_input jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare new_id uuid;
begin
  insert into public.cost_metrics(date, service, category, amount, currency, source, metadata)
  values (date_input, service_input, coalesce(category_input,'infra'), amount_input,
          coalesce(currency_input,'USD'), coalesce(source_input,'manual'), coalesce(metadata_input,'{}'::jsonb))
  returning id into new_id;
  return new_id;
end;
$function$;
revoke all on function public.record_cost_metric(date,text,numeric,text,text,text,jsonb) from public;
revoke all on function public.record_cost_metric(date,text,numeric,text,text,text,jsonb) from anon;
revoke all on function public.record_cost_metric(date,text,numeric,text,text,text,jsonb) from authenticated;
grant execute on function public.record_cost_metric(date,text,numeric,text,text,text,jsonb) to service_role;
