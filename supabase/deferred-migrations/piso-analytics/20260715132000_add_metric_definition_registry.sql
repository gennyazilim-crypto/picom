-- T59 — governed metric definition registry over daily_metrics. Applied to piso prod 2026-07-15.
-- Additive: new table `metric_definitions` (admin-read RLS) seeded from the metric names
-- present in daily_metrics, plus `check_unregistered_metrics()` to surface uncontrolled
-- metrics (metric_names written to daily_metrics without a registry entry).
-- Rollback: drop function check_unregistered_metrics(); drop table metric_definitions;
create table if not exists public.metric_definitions (
  metric_key text primary key,
  description text not null default '',
  unit text not null default 'count',
  owner text not null default 'platform',
  aggregation text not null default 'sum' check (aggregation in ('sum','avg','max','min','last')),
  pii_class text not null default 'none' check (pii_class in ('none','pseudonymous','forbidden')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.metric_definitions enable row level security;
create policy "metric defs admin read" on public.metric_definitions for select using (public.is_app_admin());

insert into public.metric_definitions(metric_key, description, owner) values
 ('event.community.created','Communities created','growth'),
 ('event.community.joined','Community joins','growth'),
 ('event.community.left','Community leaves','growth'),
 ('event.community.message.sent','Community messages sent (count only)','product'),
 ('event.dm.sent','Direct messages sent (count only)','product'),
 ('event.post.commented','Post comments','product'),
 ('event.post.created','Posts created','product'),
 ('event.post.deleted','Posts deleted','product'),
 ('event.post.liked','Post likes','product'),
 ('event.post.trended','Posts trended','product'),
 ('event.user.followed','User follows','growth'),
 ('event.voice.joined','Voice joins','product'),
 ('event.voice.left','Voice leaves','product')
on conflict (metric_key) do nothing;

create or replace function public.check_unregistered_metrics()
returns table(metric_name text, occurrences bigint)
language sql security definer set search_path to 'public' stable
as $function$
  select dm.metric_name, count(*)::bigint
  from public.daily_metrics dm
  left join public.metric_definitions md on md.metric_key = dm.metric_name
  where md.metric_key is null
  group by dm.metric_name
  order by count(*) desc;
$function$;
revoke all on function public.check_unregistered_metrics() from public;
revoke all on function public.check_unregistered_metrics() from anon;
revoke all on function public.check_unregistered_metrics() from authenticated;
grant execute on function public.check_unregistered_metrics() to service_role;
