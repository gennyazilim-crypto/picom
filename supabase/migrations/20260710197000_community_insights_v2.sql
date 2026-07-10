-- Aggregate-only community insights. No member-level rows or message/report content are returned.
create table if not exists public.community_voice_usage_daily (
  community_id uuid not null references public.communities(id) on delete cascade,
  usage_date date not null,
  session_count integer not null default 0 check (session_count >= 0),
  participant_minutes integer not null default 0 check (participant_minutes >= 0),
  peak_concurrent integer not null default 0 check (peak_concurrent >= 0),
  updated_at timestamptz not null default now(),
  primary key (community_id, usage_date)
);
alter table public.community_voice_usage_daily enable row level security;
revoke all on public.community_voice_usage_daily from public, anon, authenticated;
comment on table public.community_voice_usage_daily is 'Trusted-backend aggregate voice counters only. This table intentionally has no user identifiers.';

create or replace function public.can_view_community_insights(target_community_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from public.communities community where community.id = target_community_id and community.owner_id = auth.uid())
    or exists (select 1 from public.community_members membership join public.roles role on role.id = membership.role_id and role.community_id = membership.community_id where membership.community_id = target_community_id and membership.user_id = auth.uid() and (role.level >= 80 or coalesce((role.permissions ->> 'viewInsights')::boolean, false) or coalesce((role.permissions ->> 'manageCommunity')::boolean, false)))
  );
$$;

create or replace function public.get_community_insights_v2(target_community_id uuid, window_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare safe_window integer := least(greatest(coalesce(window_days, 30), 1), 90); window_start timestamptz; result jsonb;
begin
  if not public.can_view_community_insights(target_community_id) then raise exception 'COMMUNITY_INSIGHTS_FORBIDDEN' using errcode = '42501'; end if;
  window_start := now() - make_interval(days => safe_window);
  select jsonb_build_object(
    'generated_at', now(), 'window_days', safe_window,
    'member_count', (select count(*) from public.community_members where community_id = target_community_id),
    'new_members', (select count(*) from public.community_members where community_id = target_community_id and joined_at >= window_start),
    'active_members', (select count(distinct author_id) from public.messages where community_id = target_community_id and created_at >= window_start and deleted_at is null),
    'messages_total', (select count(*) from public.messages where community_id = target_community_id and created_at >= window_start and deleted_at is null),
    'active_channels', (select count(distinct channel_id) from public.messages where community_id = target_community_id and created_at >= window_start and deleted_at is null),
    'messages_by_channel', coalesce((select jsonb_agg(jsonb_build_object('channel_id', metric.channel_id, 'channel_name', metric.channel_name, 'channel_type', metric.channel_type, 'message_count', metric.message_count) order by metric.message_count desc) from (select channel.id as channel_id, channel.name as channel_name, channel.type as channel_type, count(message.id)::integer as message_count from public.channels channel left join public.messages message on message.channel_id = channel.id and message.created_at >= window_start and message.deleted_at is null where channel.community_id = target_community_id and public.can_view_channel(channel.id) group by channel.id, channel.name, channel.type having count(message.id) > 0 limit 20) metric), '[]'::jsonb),
    'voice_sessions', coalesce((select sum(session_count) from public.community_voice_usage_daily where community_id = target_community_id and usage_date >= window_start::date), 0),
    'voice_participant_minutes', coalesce((select sum(participant_minutes) from public.community_voice_usage_daily where community_id = target_community_id and usage_date >= window_start::date), 0),
    'voice_peak_concurrent', coalesce((select max(peak_concurrent) from public.community_voice_usage_daily where community_id = target_community_id and usage_date >= window_start::date), 0),
    'open_reports', (select count(*) from public.reports where community_id = target_community_id and status = 'open' and created_at >= window_start),
    'reports_total', (select count(*) from public.reports where community_id = target_community_id and created_at >= window_start)
  ) into result;
  return result;
end;
$$;
revoke all on function public.can_view_community_insights(uuid), public.get_community_insights_v2(uuid, integer) from public, anon;
grant execute on function public.can_view_community_insights(uuid), public.get_community_insights_v2(uuid, integer) to authenticated;
