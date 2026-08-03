-- Live Now discovery aligned with Publisher/Creator Phase 1.
-- Canonical public surface: only discovery-eligible approved publishers.
-- Search / filters / schedules / category counts stay inside security filters.

alter table public.community_live_screen_sessions
  add column if not exists tags text[] not null default '{}'::text[];

comment on column public.community_live_screen_sessions.tags is
  'Public discovery tags for Live Now search. Never include stream keys or private URLs.';

create index if not exists community_live_screen_sessions_tags_gin_idx
  on public.community_live_screen_sessions using gin (tags);

-- Public Live Now may be viewed without community membership when discovery-eligible.
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

-- Extend program state with CTA fields while preserving existing client keys.
create or replace function public.get_own_publisher_program_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  eligibility jsonb;
  profile_row public.publisher_profiles%rowtype;
  badge_row public.publisher_badges%rowtype;
  app_row public.publisher_applications%rowtype;
  cta_state text;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  eligibility := public.get_publisher_application_eligibility();

  select * into profile_row from public.publisher_profiles where user_id = actor_id;
  select * into badge_row
  from public.publisher_badges
  where user_id = actor_id
  order by
    case status when 'active' then 0 when 'suspended' then 1 else 2 end,
    approved_at desc nulls last
  limit 1;

  select * into app_row
  from public.publisher_applications
  where user_id = actor_id
  order by submitted_at desc nulls last, created_at desc
  limit 1;

  if badge_row.status = 'revoked' or profile_row.status = 'revoked' then
    cta_state := 'revoked';
  elsif badge_row.status = 'suspended' or profile_row.status = 'suspended' then
    cta_state := 'suspended';
  elsif profile_row.status = 'active'
     and badge_row.status = 'active'
     and public.user_can_broadcast_on_picom_live(actor_id) then
    cta_state := 'approved_active';
  elsif app_row.status = 'rejected' then
    cta_state := 'rejected';
  elsif app_row.status = 'additional_information_required' then
    cta_state := 'additional_information_required';
  elsif app_row.status in ('submitted', 'under_review') then
    cta_state := app_row.status;
  elsif app_row.status = 'draft' then
    cta_state := 'draft';
  elsif coalesce((eligibility->>'eligible')::boolean, false) then
    cta_state := 'eligible_not_applied';
  else
    cta_state := 'threshold_not_met';
  end if;

  return jsonb_build_object(
    'canBroadcast', public.user_can_broadcast_on_picom_live(actor_id),
    'profile', case
      when profile_row.user_id is null then null
      else jsonb_build_object(
        'accountKind', profile_row.account_kind,
        'status', profile_row.status,
        'displayPublisherName', profile_row.display_publisher_name
      )
    end,
    'activeBadge', case
      when badge_row.id is null or badge_row.status <> 'active' then null
      else jsonb_build_object(
        'id', badge_row.id,
        'badgeType', badge_row.badge_type,
        'status', badge_row.status,
        'approvedAt', badge_row.approved_at,
        'expiresAt', badge_row.expires_at
      )
    end,
    'eligibility', eligibility,
    'latestApplication', case
      when app_row.id is null then null
      else jsonb_build_object(
        'id', app_row.id,
        'applicationType', app_row.application_type,
        'status', app_row.status,
        'submittedAt', app_row.submitted_at,
        'reviewedAt', app_row.reviewed_at,
        'decisionReason', app_row.decision_reason
      )
    end,
    'ctaState', cta_state
  );
end;
$$;

revoke all on function public.get_own_publisher_program_state() from public, anon;
grant execute on function public.get_own_publisher_program_state() to authenticated;

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
    join public.publisher_badges b
      on b.user_id = s.broadcaster_user_id
     and b.status = 'active'
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

revoke all on function public.list_publisher_live_now(
  integer, timestamptz, uuid, text, text, text, boolean, text
) from public, anon;
grant execute on function public.list_publisher_live_now(
  integer, timestamptz, uuid, text, text, text, boolean, text
) to authenticated;

create or replace function public.count_publisher_live_now(
  p_search text default null,
  p_category text default null,
  p_language text default null,
  p_following_only boolean default false
)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  q text := nullif(btrim(coalesce(p_search, '')), '');
  total integer := 0;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select count(*)::integer into total
  from public.community_live_screen_sessions s
  join public.profiles p on p.id = s.broadcaster_user_id
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
        select 1 from unnest(coalesce(s.tags, '{}'::text[])) tag where tag ilike '%' || q || '%'
      )
    );

  return coalesce(total, 0);
end;
$$;

revoke all on function public.count_publisher_live_now(text, text, text, boolean) from public, anon;
grant execute on function public.count_publisher_live_now(text, text, text, boolean) to authenticated;

create or replace function public.count_publisher_live_now_by_category()
returns table (
  category text,
  live_count integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  return query
  select
    coalesce(nullif(btrim(s.category), ''), 'other') as category,
    count(*)::integer as live_count
  from public.community_live_screen_sessions s
  where public.live_session_is_publisher_discovery_eligible(s)
    and not public.users_are_blocked(actor_id, s.broadcaster_user_id)
    and not exists (
      select 1 from public.community_live_hidden_communities hidden
      where hidden.user_id = actor_id and hidden.community_id = s.community_id
    )
  group by 1
  having count(*) > 0
  order by live_count desc, category asc;
end;
$$;

revoke all on function public.count_publisher_live_now_by_category() from public, anon;
grant execute on function public.count_publisher_live_now_by_category() to authenticated;

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
  join public.publisher_badges b
    on b.user_id = sch.owner_user_id
   and b.status = 'active'
  join public.publisher_profiles pp
    on pp.user_id = sch.owner_user_id
   and pp.status = 'active'
  where sch.status = 'scheduled'
    and sch.visibility = 'public'
    and sch.scheduled_start_at >= now()
    and public.publisher_profile_is_active_account(sch.owner_user_id)
    and not public.user_has_active_publisher_live_ban(sch.owner_user_id)
    and not public.users_are_blocked(actor_id, sch.owner_user_id)
  order by sch.scheduled_start_at asc
  limit safe_limit;
end;
$$;

revoke all on function public.list_upcoming_publisher_schedules(integer) from public, anon;
grant execute on function public.list_upcoming_publisher_schedules(integer) to authenticated;
