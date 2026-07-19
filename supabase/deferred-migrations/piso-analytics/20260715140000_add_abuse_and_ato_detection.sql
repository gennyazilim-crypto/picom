-- T78 coordinated abuse + T79 account-takeover detection. Applied to piso prod 2026-07-15.
-- Additive, non-destructive. Reads security_events; writes aggregated signals only. Raw IP is
-- never stored — cluster key is a salted sha256. Security legal basis; service_role only.
-- Rollback: drop function detect_account_takeover(integer,integer,integer);
--           drop function detect_coordinated_abuse(integer,integer); drop table abuse_signals;
create table if not exists public.abuse_signals (
  id uuid primary key default gen_random_uuid(),
  signal_type text not null,
  cluster_key text,
  subject_user uuid,
  distinct_count integer,
  events integer,
  confidence numeric,
  details jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now()
);
create index if not exists abuse_signals_detected_idx on public.abuse_signals (detected_at desc);
create index if not exists abuse_signals_type_idx on public.abuse_signals (signal_type, detected_at desc);
alter table public.abuse_signals enable row level security;
create policy "abuse signals admin read" on public.abuse_signals for select using (public.is_app_admin());

create or replace function public.detect_coordinated_abuse(window_hours integer default 24, min_users integer default 3)
returns setof public.abuse_signals
language plpgsql security definer set search_path to 'public'
as $function$
begin
  insert into public.abuse_signals(signal_type, cluster_key, distinct_count, events, confidence, details)
  select 'coordinated_ip',
    encode(sha256(convert_to((select salt from public.analytics_pseudonymization_salt where id) || coalesce(se.ip_address,''), 'UTF8')), 'hex'),
    count(distinct se.user_id), count(*),
    least(1.0, count(distinct se.user_id)::numeric / 10.0),
    jsonb_build_object('window_hours', window_hours)
  from public.security_events se
  where se.created_at >= now() - make_interval(hours => greatest(window_hours,1))
    and se.ip_address is not null
  group by se.ip_address
  having count(distinct se.user_id) >= greatest(min_users,2);
  return query select * from public.abuse_signals where detected_at >= now() - interval '1 minute' and signal_type='coordinated_ip' order by detected_at desc;
end;
$function$;
revoke all on function public.detect_coordinated_abuse(integer,integer) from public;
revoke all on function public.detect_coordinated_abuse(integer,integer) from anon;
revoke all on function public.detect_coordinated_abuse(integer,integer) from authenticated;
grant execute on function public.detect_coordinated_abuse(integer,integer) to service_role;

create or replace function public.detect_account_takeover(window_hours integer default 24, min_ips integer default 3, risk_floor integer default 80)
returns setof public.abuse_signals
language plpgsql security definer set search_path to 'public'
as $function$
begin
  insert into public.abuse_signals(signal_type, subject_user, distinct_count, events, confidence, details)
  select 'account_takeover', se.user_id, count(distinct se.ip_address), count(*),
    least(1.0, greatest(count(distinct se.ip_address)::numeric / 5.0, coalesce(max(se.risk_score),0)::numeric / 100.0)),
    jsonb_build_object('max_risk', max(se.risk_score), 'window_hours', window_hours)
  from public.security_events se
  where se.created_at >= now() - make_interval(hours => greatest(window_hours,1))
    and se.user_id is not null
  group by se.user_id
  having count(distinct se.ip_address) >= greatest(min_ips,2) or coalesce(max(se.risk_score),0) >= risk_floor;
  return query select * from public.abuse_signals where detected_at >= now() - interval '1 minute' and signal_type='account_takeover' order by detected_at desc;
end;
$function$;
revoke all on function public.detect_account_takeover(integer,integer,integer) from public;
revoke all on function public.detect_account_takeover(integer,integer,integer) from anon;
revoke all on function public.detect_account_takeover(integer,integer,integer) from authenticated;
grant execute on function public.detect_account_takeover(integer,integer,integer) to service_role;
