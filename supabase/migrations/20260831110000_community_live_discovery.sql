-- Community Live Discovery — an isolated, opt-in discovery surface for normal
-- PICOM members' public-community live sessions.  It deliberately does not
-- change the Creator/Publisher catalogue, ranking functions, or broadcast gate.
--
-- Forward-only.  This migration is source-only until separately approved for a
-- production database deployment.

begin;

create table if not exists public.live_discovery_exposures (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  broadcast_id uuid not null references public.community_live_screen_sessions(id) on delete cascade,
  source text not null default 'community_live' check (source in ('community_live')),
  position smallint not null check (position between 0 and 19),
  shown_at timestamptz not null default now(),
  clicked_at timestamptz,
  watch_started_at timestamptz,
  watch_duration_ms integer,
  dismissed_at timestamptz,
  check (watch_duration_ms is null or watch_duration_ms between 0 and 86400000)
);

create index if not exists live_discovery_exposures_viewer_recent_idx
  on public.live_discovery_exposures(viewer_id, source, shown_at desc);
create index if not exists live_discovery_exposures_viewer_broadcast_recent_idx
  on public.live_discovery_exposures(viewer_id, broadcast_id, shown_at desc);
create index if not exists live_discovery_exposures_dismissed_idx
  on public.live_discovery_exposures(viewer_id, dismissed_at desc)
  where dismissed_at is not null;

create table if not exists public.live_discovery_events (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  broadcast_id uuid references public.community_live_screen_sessions(id) on delete cascade,
  source text not null default 'community_live' check (source in ('community_live')),
  event_type text not null check (event_type in (
    'live_discovery_section_view',
    'live_discovery_impression',
    'live_discovery_refresh',
    'live_discovery_click',
    'live_discovery_watch_start',
    'live_discovery_watch_30s',
    'live_discovery_follow',
    'live_discovery_dismiss'
  )),
  position smallint check (position between 0 and 19),
  watch_duration_ms integer,
  created_at timestamptz not null default now(),
  check (watch_duration_ms is null or watch_duration_ms between 0 and 86400000),
  check (
    (event_type in ('live_discovery_section_view', 'live_discovery_refresh') and broadcast_id is null)
    or (event_type not in ('live_discovery_section_view', 'live_discovery_refresh') and broadcast_id is not null)
  )
);

create index if not exists live_discovery_events_viewer_recent_idx
  on public.live_discovery_events(viewer_id, created_at desc);
create index if not exists live_discovery_events_broadcast_recent_idx
  on public.live_discovery_events(broadcast_id, created_at desc)
  where broadcast_id is not null;

-- Narrows the candidate pool before the per-viewer authorization helper runs.
-- It deliberately contains no viewer-count ordering so large streams do not
-- displace small-community discovery candidates.
create index if not exists community_live_screen_sessions_community_discovery_candidate_idx
  on public.community_live_screen_sessions(last_heartbeat_at desc, started_at desc)
  where status = 'live'
    and deleted_at is null
    and hidden_at is null
    and moderation_status = 'approved'
    and visibility_mode <> 'public_discovery';

alter table public.live_discovery_exposures enable row level security;
alter table public.live_discovery_events enable row level security;

revoke all on public.live_discovery_exposures from public, anon, authenticated;
revoke all on public.live_discovery_events from public, anon, authenticated;
grant select on public.live_discovery_exposures, public.live_discovery_events to authenticated;
grant all on public.live_discovery_exposures, public.live_discovery_events to service_role;

drop policy if exists live_discovery_exposures_owner_select on public.live_discovery_exposures;
create policy live_discovery_exposures_owner_select
  on public.live_discovery_exposures for select to authenticated
  using (viewer_id = auth.uid());

drop policy if exists live_discovery_events_owner_select on public.live_discovery_events;
create policy live_discovery_events_owner_select
  on public.live_discovery_events for select to authenticated
  using (viewer_id = auth.uid());

-- This is intentionally separate from live_session_is_publisher_discovery_eligible.
-- A normal community broadcaster is eligible only from a reviewed public community
-- and a public channel which the current viewer is already authorized to view.
create or replace function public.can_view_community_live_discovery_session(
  target public.community_live_screen_sessions
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and target.status = 'live'
    and target.last_heartbeat_at >= now() - interval '60 seconds'
    and coalesce(target.visibility_mode, 'channel_members') <> 'public_discovery'
    and target.deleted_at is null
    and target.hidden_at is null
    and coalesce(target.moderation_status, 'approved') = 'approved'
    and public.publisher_profile_is_active_account(target.broadcaster_user_id)
    -- Keep active Creator/Publisher broadcasts in the authoritative Publisher
    -- catalogue. Pending/rejected applications alone do not suppress a normal
    -- member's community stream.
    and not exists (
      select 1 from public.publisher_badges publisher_badge
      where publisher_badge.user_id = target.broadcaster_user_id
        and publisher_badge.status = 'active'
    )
    and not public.users_are_blocked(auth.uid(), target.broadcaster_user_id)
    and not exists (
      select 1 from public.community_live_hidden_communities hidden
      where hidden.user_id = auth.uid() and hidden.community_id = target.community_id
    )
    and not exists (
      select 1 from public.community_bans ban
      where ban.community_id = target.community_id
        and ban.user_id = target.broadcaster_user_id
        and ban.revoked_at is null
    )
    and exists (
      select 1
      from public.communities community
      left join public.community_discovery_reviews review
        on review.community_id = community.id
      where community.id = target.community_id
        and community.visibility = 'public'
        and coalesce(community.public_read_enabled, false)
        and coalesce(community.discovery_listed, false)
        and coalesce(review.status, 'pending') = 'approved'
        -- The existing discovery classification is conservative for this surface:
        -- public communities marked for mature topics are never sampled here.
        and not ('mature_topics' = any(coalesce(community.discovery_content_flags, '{}'::text[])))
    )
    and exists (
      select 1
      from public.channels channel
      where channel.id = target.channel_id
        and channel.community_id = target.community_id
        and coalesce(channel.is_private, false) = false
        and coalesce(channel.public_read_enabled, false)
    )
    and public.can_view_channel(target.channel_id)
;
$$;

revoke all on function public.can_view_community_live_discovery_session(public.community_live_screen_sessions)
  from public, anon;
grant execute on function public.can_view_community_live_discovery_session(public.community_live_screen_sessions)
  to authenticated;

-- Keep the existing Publisher/Creator public access branch intact. The only
-- additional access is this helper's much stricter reviewed-public-community
-- branch, which makes a listed card watchable by the same viewer. Legacy
-- member-only community sessions retain their original branch unchanged.
create or replace function public.can_view_live_screen_session(target public.community_live_screen_sessions)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and target.status in ('live', 'reconnecting')
    and target.deleted_at is null
    and target.hidden_at is null
    and coalesce(target.moderation_status, 'approved') = 'approved'
    and not public.users_are_blocked(auth.uid(), target.broadcaster_user_id)
    and not exists (
      select 1 from public.community_live_hidden_communities hidden
      where hidden.user_id = auth.uid() and hidden.community_id = target.community_id
    )
    and (
      public.live_session_is_publisher_discovery_eligible(target)
      or public.can_view_community_live_discovery_session(target)
      or (
        coalesce(target.visibility_mode, 'channel_members') <> 'public_discovery'
        and public.can_view_channel(target.channel_id)
        and public.is_active_community_media_member(target.community_id, auth.uid())
        and exists (
          select 1
          from public.channels channel
          where channel.id = target.channel_id
            and (
              not channel.is_private
              or public.is_community_owner(channel.community_id)
              or public.has_community_role_level(channel.community_id, 80)
              or public.has_community_permission(channel.community_id, 'viewPrivateChannels')
            )
        )
      )
    );
$$;

revoke all on function public.can_view_live_screen_session(public.community_live_screen_sessions)
  from public, anon;
grant execute on function public.can_view_live_screen_session(public.community_live_screen_sessions)
  to authenticated;

create or replace function public.list_community_live_discovery(
  p_limit integer default 12,
  p_seed text default null,
  p_exclude_broadcast_ids uuid[] default '{}'::uuid[],
  p_locale text default null,
  p_category text default null
)
returns table (
  id uuid,
  community_id uuid,
  channel_id uuid,
  broadcaster_user_id uuid,
  title text,
  status text,
  category text,
  language_code text,
  viewer_count integer,
  started_at timestamptz,
  last_heartbeat_at timestamptz,
  community_name text,
  channel_name text,
  broadcaster_display_name text,
  broadcaster_username text,
  broadcaster_avatar_url text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  safe_limit integer := greatest(1, least(coalesce(p_limit, 12), 20));
  stable_seed text := left(coalesce(nullif(btrim(p_seed), ''), actor_id::text), 128);
  time_bucket text := floor(extract(epoch from now()) / 60)::bigint::text;
  normalized_locale text := left(lower(btrim(coalesce(p_locale, ''))), 16);
  normalized_category text := lower(btrim(coalesce(p_category, '')));
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if normalized_category not in ('', 'game', 'chat', 'education', 'watch_together', 'other') then
    raise exception 'COMMUNITY_DISCOVERY_CATEGORY_INVALID' using errcode = '22023';
  end if;

  return query
  with eligible as (
    select
      session.id,
      session.community_id,
      session.channel_id,
      session.broadcaster_user_id,
      session.title,
      session.status::text as status,
      session.category,
      coalesce(session.language_code, '') as language_code,
      session.viewer_count,
      session.started_at,
      session.last_heartbeat_at,
      community.name as community_name,
      channel.name as channel_name,
      coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(profile.username), ''), '') as broadcaster_display_name,
      profile.username as broadcaster_username,
      profile.avatar_url as broadcaster_avatar_url,
      case when session.id = any(coalesce(p_exclude_broadcast_ids, '{}'::uuid[])) then 1 else 0 end as excluded_by_client,
      exists (
        select 1
        from public.live_discovery_exposures exposure
        where exposure.viewer_id = actor_id
          and exposure.broadcast_id = session.id
          and exposure.source = 'community_live'
          and (
            exposure.shown_at >= now() - interval '45 minutes'
            or exposure.dismissed_at >= now() - interval '24 hours'
          )
      ) as recently_exposed,
      md5(concat_ws(':', stable_seed, time_bucket, session.id::text)) as shuffle_key
    from public.community_live_screen_sessions session
    join public.communities community on community.id = session.community_id
    join public.channels channel on channel.id = session.channel_id
    join public.profiles profile on profile.id = session.broadcaster_user_id
    where session.status = 'live'
      and session.last_heartbeat_at >= now() - interval '60 seconds'
      and session.deleted_at is null
      and session.hidden_at is null
      and session.moderation_status = 'approved'
      and session.visibility_mode <> 'public_discovery'
      and public.can_view_community_live_discovery_session(session)
      and (normalized_locale = '' or lower(coalesce(session.language_code, '')) = normalized_locale)
      and (normalized_category = '' or lower(session.category) = normalized_category)
  ), ranked as (
    select
      eligible.*,
      row_number() over (
        partition by broadcaster_user_id
        order by recently_exposed, excluded_by_client, shuffle_key, id
      ) as broadcaster_rank,
      row_number() over (
        partition by community_id
        order by recently_exposed, excluded_by_client, shuffle_key, id
      ) as community_rank,
      row_number() over (
        partition by category
        order by recently_exposed, excluded_by_client, shuffle_key, id
      ) as category_rank
    from eligible
  ), strict_pool as (
    select ranked.*, 0 as diversity_fallback
    from ranked
    where broadcaster_rank <= 1
      and community_rank <= 2
      and category_rank <= 4
  ), relaxed_pool as (
    select ranked.*, 1 as diversity_fallback
    from ranked
    where broadcaster_rank <= 1
      and not exists (select 1 from strict_pool strict where strict.id = ranked.id)
  ), selected as (
    select * from strict_pool
    union all
    select * from relaxed_pool
    where (select count(*) from strict_pool) < safe_limit
  )
  select
    selected.id,
    selected.community_id,
    selected.channel_id,
    selected.broadcaster_user_id,
    selected.title,
    selected.status,
    selected.category,
    selected.language_code,
    selected.viewer_count,
    selected.started_at,
    selected.last_heartbeat_at,
    selected.community_name,
    selected.channel_name,
    selected.broadcaster_display_name,
    selected.broadcaster_username,
    selected.broadcaster_avatar_url
  from selected
  -- md5 is a stable per-viewer/time-bucket sampler. A random database sort is
  -- deliberately not used on a production-sized session table.
  order by
    selected.recently_exposed,
    selected.excluded_by_client,
    selected.diversity_fallback,
    selected.shuffle_key,
    selected.id
  limit safe_limit;
end;
$$;

comment on function public.list_community_live_discovery(integer, text, uuid[], text, text) is
  'Community Live Discovery only. Hash-seeded, exposure-aware normal-user sampling; does not call or alter publisher ranking.';

revoke all on function public.list_community_live_discovery(integer, text, uuid[], text, text)
  from public, anon;
grant execute on function public.list_community_live_discovery(integer, text, uuid[], text, text)
  to authenticated;

create or replace function public.record_community_live_discovery_impressions(
  p_broadcast_ids uuid[],
  p_positions smallint[]
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  item_id uuid;
  item_position smallint;
  accepted_count integer := 0;
  item_index integer;
  session_row public.community_live_screen_sessions%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if coalesce(array_length(p_broadcast_ids, 1), 0) < 1
     or array_length(p_broadcast_ids, 1) > 20
     or array_length(p_broadcast_ids, 1) <> array_length(p_positions, 1) then
    raise exception 'COMMUNITY_DISCOVERY_IMPRESSION_INPUT_INVALID' using errcode = '22023';
  end if;

  for item_index in 1..array_length(p_broadcast_ids, 1) loop
    item_id := p_broadcast_ids[item_index];
    item_position := p_positions[item_index];
    if item_id is null or item_position is null or item_position < 0 or item_position > 19 then
      raise exception 'COMMUNITY_DISCOVERY_IMPRESSION_INPUT_INVALID' using errcode = '22023';
    end if;

    select * into session_row
    from public.community_live_screen_sessions session
    where session.id = item_id;

    if found and public.can_view_community_live_discovery_session(session_row) then
      insert into public.live_discovery_exposures(viewer_id, broadcast_id, source, position)
      values (actor_id, item_id, 'community_live', item_position);
      insert into public.live_discovery_events(viewer_id, broadcast_id, source, event_type, position)
      values (actor_id, item_id, 'community_live', 'live_discovery_impression', item_position);
      accepted_count := accepted_count + 1;
    end if;
  end loop;

  return accepted_count;
end;
$$;

revoke all on function public.record_community_live_discovery_impressions(uuid[], smallint[])
  from public, anon;
grant execute on function public.record_community_live_discovery_impressions(uuid[], smallint[])
  to authenticated;

create or replace function public.record_community_live_discovery_event(
  p_event_type text,
  p_broadcast_id uuid default null,
  p_position smallint default null,
  p_watch_duration_ms integer default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  event_type text := lower(btrim(coalesce(p_event_type, '')));
  session_row public.community_live_screen_sessions%rowtype;
  has_recent_exposure boolean := false;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if event_type not in (
    'live_discovery_section_view', 'live_discovery_refresh', 'live_discovery_click',
    'live_discovery_watch_start', 'live_discovery_watch_30s', 'live_discovery_follow',
    'live_discovery_dismiss'
  ) then
    raise exception 'COMMUNITY_DISCOVERY_EVENT_INVALID' using errcode = '22023';
  end if;
  if p_position is not null and (p_position < 0 or p_position > 19) then
    raise exception 'COMMUNITY_DISCOVERY_EVENT_INVALID' using errcode = '22023';
  end if;
  if p_watch_duration_ms is not null and (p_watch_duration_ms < 0 or p_watch_duration_ms > 86400000) then
    raise exception 'COMMUNITY_DISCOVERY_EVENT_INVALID' using errcode = '22023';
  end if;

  if event_type in ('live_discovery_section_view', 'live_discovery_refresh') then
    if p_broadcast_id is not null then
      raise exception 'COMMUNITY_DISCOVERY_EVENT_INVALID' using errcode = '22023';
    end if;
    insert into public.live_discovery_events(viewer_id, source, event_type, position, watch_duration_ms)
    values (actor_id, 'community_live', event_type, p_position, p_watch_duration_ms);
    return true;
  end if;

  if p_broadcast_id is null then
    raise exception 'COMMUNITY_DISCOVERY_EVENT_INVALID' using errcode = '22023';
  end if;

  select * into session_row
  from public.community_live_screen_sessions session
  where session.id = p_broadcast_id;
  if not found or not public.can_view_community_live_discovery_session(session_row) then
    raise exception 'COMMUNITY_DISCOVERY_EVENT_FORBIDDEN' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.live_discovery_exposures exposure
    where exposure.viewer_id = actor_id
      and exposure.broadcast_id = p_broadcast_id
      and exposure.source = 'community_live'
      and exposure.shown_at >= now() - interval '24 hours'
  ) into has_recent_exposure;
  if not has_recent_exposure then
    raise exception 'COMMUNITY_DISCOVERY_EXPOSURE_REQUIRED' using errcode = '42501';
  end if;

  insert into public.live_discovery_events(viewer_id, broadcast_id, source, event_type, position, watch_duration_ms)
  values (actor_id, p_broadcast_id, 'community_live', event_type, p_position, p_watch_duration_ms);

  if event_type = 'live_discovery_click' then
    update public.live_discovery_exposures
    set clicked_at = coalesce(clicked_at, now())
    where id = (
      select exposure.id from public.live_discovery_exposures exposure
      where exposure.viewer_id = actor_id and exposure.broadcast_id = p_broadcast_id and exposure.source = 'community_live'
      order by exposure.shown_at desc limit 1
    );
  elsif event_type = 'live_discovery_watch_start' then
    update public.live_discovery_exposures
    set watch_started_at = coalesce(watch_started_at, now())
    where id = (
      select exposure.id from public.live_discovery_exposures exposure
      where exposure.viewer_id = actor_id and exposure.broadcast_id = p_broadcast_id and exposure.source = 'community_live'
      order by exposure.shown_at desc limit 1
    );
  elsif event_type = 'live_discovery_watch_30s' then
    update public.live_discovery_exposures
    set watch_duration_ms = greatest(coalesce(watch_duration_ms, 0), least(coalesce(p_watch_duration_ms, 30000), 30000))
    where id = (
      select exposure.id from public.live_discovery_exposures exposure
      where exposure.viewer_id = actor_id and exposure.broadcast_id = p_broadcast_id and exposure.source = 'community_live'
      order by exposure.shown_at desc limit 1
    );
  elsif event_type = 'live_discovery_dismiss' then
    update public.live_discovery_exposures
    set dismissed_at = now()
    where id = (
      select exposure.id from public.live_discovery_exposures exposure
      where exposure.viewer_id = actor_id and exposure.broadcast_id = p_broadcast_id and exposure.source = 'community_live'
      order by exposure.shown_at desc limit 1
    );
  end if;

  return true;
end;
$$;

revoke all on function public.record_community_live_discovery_event(text, uuid, smallint, integer)
  from public, anon;
grant execute on function public.record_community_live_discovery_event(text, uuid, smallint, integer)
  to authenticated;

comment on table public.live_discovery_exposures is
  'Viewer-local Community Live Discovery exposure and suppression state. No messages, signed URLs, or credentials.';
comment on table public.live_discovery_events is
  'Privacy-safe Community Live Discovery interaction events. No message body, tokens, email, phone, or signed URLs.';

notify pgrst, 'reload schema';

commit;
