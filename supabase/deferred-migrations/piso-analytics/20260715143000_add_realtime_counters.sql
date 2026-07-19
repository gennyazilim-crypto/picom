-- T81 (DB side) — near-realtime aggregate counters. Applied to piso prod 2026-07-15.
-- Additive; aggregate counts only (no identity/content). Refreshed every minute via pg_cron.
-- Verified live: counters populated (voice_participants_now=1, queue_pending=0 — also confirms
-- the T82 queue-processor cron is draining). True sub-second streaming (external consumer) stays
-- an operator option per OPERATOR_RUNBOOK_INFRA_ML_TASKS.md.
-- Rollback: select cron.unschedule('refresh-realtime-counters');
--           drop function refresh_realtime_counters(); drop table realtime_counters;
create table if not exists public.realtime_counters (
  metric text primary key,
  value numeric not null,
  updated_at timestamptz not null default now()
);
alter table public.realtime_counters enable row level security;
create policy "realtime counters admin read" on public.realtime_counters for select using (public.is_app_admin());

create or replace function public.refresh_realtime_counters()
returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  insert into public.realtime_counters(metric, value, updated_at) values
    ('events_last_5m', (select count(*) from public.analytics_events where created_at >= now() - interval '5 minutes'), now()),
    ('active_actors_last_15m', (select count(distinct actor_user_id) from public.analytics_events where created_at >= now() - interval '15 minutes' and actor_user_id is not null), now()),
    ('queue_pending', (select count(*) from public.analytics_event_queue where status = 'pending'), now()),
    ('voice_participants_now', (select count(*) from public.voice_room_participants), now()),
    ('voice_sessions_active', (select count(*) from public.community_voice_sessions where ended_at is null), now())
  on conflict (metric) do update set value = excluded.value, updated_at = excluded.updated_at;
end;
$function$;
revoke all on function public.refresh_realtime_counters() from public;
revoke all on function public.refresh_realtime_counters() from anon;
revoke all on function public.refresh_realtime_counters() from authenticated;
grant execute on function public.refresh_realtime_counters() to service_role;

select cron.unschedule('refresh-realtime-counters')
  where exists (select 1 from cron.job where jobname = 'refresh-realtime-counters');
select cron.schedule('refresh-realtime-counters', '* * * * *',
  $$select public.refresh_realtime_counters();$$);

select public.refresh_realtime_counters();
