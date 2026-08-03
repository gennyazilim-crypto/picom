-- Fix Live Now discovery list/count consistency: one allowlisted active badge per broadcaster.
-- Previous INNER JOIN on publisher_badges could duplicate sessions when multiple active badges exist.
-- Schedules use the same badge selection rule. Does not change Case 04 eligibility counting.

begin;

create or replace function public.list_publisher_live_now(
  p_limit integer default 24,
  p_cursor_started_at timestamptz default null,
  p_cursor_id uuid default null,
  p_search text default null,
  p_category text default null,
  p_language text default null,
  p_following_only boolean default false,
  p_sort text default 'viewers'
)
returns table (
  id uuid,
  community_id uuid,
  channel_id uuid,
  broadcaster_user_id uuid,
  title text,
  status text,
  visibility_mode text,
  category text,
  language_code text,
  tags text[],
  viewer_count integer,
  started_at timestamptz,
  last_heartbeat_at timestamptz,
  community_name text,
  channel_name text,
  broadcaster_display_name text,
  broadcaster_username text,
  broadcaster_avatar_url text,
  publisher_badge_type text,
  content_warning text,
  age_restricted boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  safe_limit integer := greatest(1, least(coalesce(p_limit, 24), 50));
  q text := nullif(btrim(coalesce(p_search, '')), '');
  sort_mode text := lower(coalesce(nullif(btrim(p_sort), ''), 'viewers'));
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if sort_mode not in ('viewers', 'newest', 'following') then
    sort_mode := 'viewers';
  end if;

  return query
  with candidates as (
    select
      s.id,
      s.community_id,
      s.channel_id,
      s.broadcaster_user_id,
      s.title,
      s.status::text as status,
      coalesce(s.visibility_mode, 'channel_members')::text as visibility_mode,
      s.category,
      coalesce(s.language_code, '') as language_code,
      coalesce(s.tags, '{}'::text[]) as tags,
      s.viewer_count,
      s.started_at,
      s.last_heartbeat_at,
      c.name as community_name,
      ch.name as channel_name,
      coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.username), ''), 'Publisher') as broadcaster_display_name,
      p.username as broadcaster_username,
      p.avatar_url as broadcaster_avatar_url,
      b.badge_type::text as publisher_badge_type,
      null::text as content_warning,
      false as age_restricted
    from public.community_live_screen_sessions s
    join public.communities c on c.id = s.community_id
    join public.channels ch on ch.id = s.channel_id
    join public.profiles p on p.id = s.broadcaster_user_id
    join lateral (
      select badge.badge_type
      from public.publisher_badges badge
      where badge.user_id = s.broadcaster_user_id
        and badge.status = 'active'
        and badge.badge_type in ('creator', 'publisher', 'verified_creator', 'verified_publisher')
        and (badge.expires_at is null or badge.expires_at > now())
      order by badge.approved_at desc nulls last, badge.id desc
      limit 1
    ) b on true
    where public.live_session_is_publisher_discovery_eligible(s)
      and not public.users_are_blocked(actor_id, s.broadcaster_user_id)
      and not exists (
        select 1 from public.community_live_hidden_communities hidden
        where hidden.user_id = actor_id and hidden.community_id = s.community_id
      )
      and (p_category is null or btrim(p_category) = '' or lower(s.category) = lower(btrim(p_category)))
      and (p_language is null or btrim(p_language) = '' or lower(s.language_code) = lower(btrim(p_language)))
      and (
        not coalesce(p_following_only, false)
        or exists (
          select 1
          from public.user_follows follow
          where follow.follower_id = actor_id
            and follow.followed_id = s.broadcaster_user_id
        )
      )
      and (
        q is null
        or s.title ilike '%' || q || '%'
        or p.display_name ilike '%' || q || '%'
        or p.username ilike '%' || q || '%'
        or coalesce(s.category, '') ilike '%' || q || '%'
        or coalesce(s.language_code, '') ilike '%' || q || '%'
        or exists (
          select 1
          from unnest(coalesce(s.tags, '{}'::text[])) tag
          where tag ilike '%' || q || '%'
        )
      )
      and (
        p_cursor_started_at is null
        or p_cursor_id is null
        or (s.started_at, s.id) < (p_cursor_started_at, p_cursor_id)
      )
  )
  select *
  from candidates c2
  order by
    case when sort_mode = 'newest' then extract(epoch from c2.started_at) else null end desc nulls last,
    case when sort_mode <> 'newest' then c2.viewer_count else null end desc nulls last,
    c2.started_at desc,
    c2.id desc
  limit safe_limit;
end;
$$;

comment on function public.list_publisher_live_now(integer, timestamptz, uuid, text, text, text, boolean, text) is
  'Public Live Now discovery list. Eligibility via live_session_is_publisher_discovery_eligible; one allowlisted active badge per broadcaster (no duplicate rows). Never returns stream keys or private URLs.';

revoke all on function public.list_publisher_live_now(
  integer, timestamptz, uuid, text, text, text, boolean, text
) from public, anon;
grant execute on function public.list_publisher_live_now(
  integer, timestamptz, uuid, text, text, text, boolean, text
) to authenticated;

create or replace function public.list_upcoming_publisher_schedules(
  p_limit integer default 12
)
returns table (
  id uuid,
  publisher_user_id uuid,
  title text,
  category text,
  language_code text,
  scheduled_start_at timestamptz,
  timezone text,
  publisher_display_name text,
  publisher_username text,
  publisher_avatar_url text,
  publisher_badge_type text,
  tags text[]
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  safe_limit integer := greatest(1, least(coalesce(p_limit, 12), 40));
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  return query
  select
    sch.id,
    sch.owner_user_id as publisher_user_id,
    sch.title,
    sch.category,
    ''::text as language_code,
    sch.scheduled_start_at,
    sch.timezone,
    coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.username), ''), 'Publisher') as publisher_display_name,
    p.username as publisher_username,
    p.avatar_url as publisher_avatar_url,
    b.badge_type::text as publisher_badge_type,
    coalesce(sch.tags, '{}'::text[]) as tags
  from public.publisher_stream_schedules sch
  join public.profiles p on p.id = sch.owner_user_id
  join lateral (
    select badge.badge_type
    from public.publisher_badges badge
    where badge.user_id = sch.owner_user_id
      and badge.status = 'active'
      and badge.badge_type in ('creator', 'publisher', 'verified_creator', 'verified_publisher')
      and (badge.expires_at is null or badge.expires_at > now())
    order by badge.approved_at desc nulls last, badge.id desc
    limit 1
  ) b on true
  join public.publisher_profiles pp
    on pp.user_id = sch.owner_user_id
   and pp.status = 'active'
  where sch.status = 'scheduled'
    and sch.visibility = 'public'
    and sch.scheduled_start_at >= now()
    and public.publisher_profile_is_active_account(sch.owner_user_id)
    and not public.user_has_active_publisher_live_ban(sch.owner_user_id)
    and not public.users_are_blocked(actor_id, sch.owner_user_id)
  order by sch.scheduled_start_at asc, sch.id asc
  limit safe_limit;
end;
$$;

comment on function public.list_upcoming_publisher_schedules(integer) is
  'Upcoming public publisher schedules for approved/active accounts with one allowlisted active badge. Schedule is not required for live discovery.';

revoke all on function public.list_upcoming_publisher_schedules(integer) from public, anon;
grant execute on function public.list_upcoming_publisher_schedules(integer) to authenticated;

commit;
