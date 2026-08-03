-- Canonical Live page registry: active community voice-channel screen shares.
-- Reuses LiveKit room naming (community:{id}:voice:{channelId}).
-- Does not duplicate voice rooms, DM calls, or meeting screen leases.

begin;

create table if not exists public.community_live_screen_sessions (
  id uuid primary key default gen_random_uuid(),
  livekit_room_name text not null,
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  broadcaster_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 160),
  category text not null default 'other'
    check (category in ('game', 'chat', 'education', 'watch_together', 'other')),
  application_name text not null default '' check (char_length(application_name) <= 120),
  status text not null default 'live'
    check (status in ('live', 'reconnecting', 'ended', 'terminated')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_heartbeat_at timestamptz not null default now(),
  viewer_count integer not null default 0 check (viewer_count >= 0),
  participant_count integer not null default 0 check (participant_count >= 0),
  preview_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists community_live_screen_sessions_active_channel_uidx
  on public.community_live_screen_sessions(channel_id)
  where status in ('live', 'reconnecting');

create index if not exists community_live_screen_sessions_visible_idx
  on public.community_live_screen_sessions(status, started_at desc)
  where status in ('live', 'reconnecting');

create index if not exists community_live_screen_sessions_community_idx
  on public.community_live_screen_sessions(community_id, status);

create index if not exists community_live_screen_sessions_broadcaster_idx
  on public.community_live_screen_sessions(broadcaster_user_id, status);

create table if not exists public.community_live_screen_viewers (
  session_id uuid not null references public.community_live_screen_sessions(id) on delete cascade,
  viewer_user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (session_id, viewer_user_id)
);

create index if not exists community_live_screen_viewers_seen_idx
  on public.community_live_screen_viewers(last_seen_at);

create table if not exists public.community_live_hidden_communities (
  user_id uuid not null references public.profiles(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, community_id)
);

create table if not exists public.community_live_share_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.community_live_screen_sessions(id) on delete cascade,
  reporter_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  created_at timestamptz not null default now(),
  unique (session_id, reporter_user_id)
);

alter table public.community_live_screen_sessions enable row level security;
alter table public.community_live_screen_viewers enable row level security;
alter table public.community_live_hidden_communities enable row level security;
alter table public.community_live_share_reports enable row level security;

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
    and public.can_view_channel(target.channel_id)
    and public.is_active_community_media_member(target.community_id, auth.uid())
    and not public.users_are_blocked(auth.uid(), target.broadcaster_user_id)
    and not exists (
      select 1 from public.community_live_hidden_communities hidden
      where hidden.user_id = auth.uid() and hidden.community_id = target.community_id
    );
$$;

revoke all on function public.can_view_live_screen_session(public.community_live_screen_sessions) from public, anon;
grant execute on function public.can_view_live_screen_session(public.community_live_screen_sessions) to authenticated;

drop policy if exists community_live_screen_sessions_select on public.community_live_screen_sessions;
create policy community_live_screen_sessions_select
  on public.community_live_screen_sessions
  for select to authenticated
  using (public.can_view_live_screen_session(community_live_screen_sessions));

drop policy if exists community_live_screen_sessions_broadcaster_update on public.community_live_screen_sessions;
create policy community_live_screen_sessions_broadcaster_update
  on public.community_live_screen_sessions
  for update to authenticated
  using (
    broadcaster_user_id = auth.uid()
    or public.has_community_role_level(community_id, 80)
  )
  with check (
    broadcaster_user_id = auth.uid()
    or public.has_community_role_level(community_id, 80)
  );

revoke insert, delete on public.community_live_screen_sessions from authenticated, anon, public;
grant select, update on public.community_live_screen_sessions to authenticated;
grant all on public.community_live_screen_sessions to service_role;

drop policy if exists community_live_screen_viewers_select on public.community_live_screen_viewers;
create policy community_live_screen_viewers_select
  on public.community_live_screen_viewers
  for select to authenticated
  using (
    exists (
      select 1 from public.community_live_screen_sessions session
      where session.id = community_live_screen_viewers.session_id
        and public.can_view_live_screen_session(session)
    )
  );

revoke insert, update, delete on public.community_live_screen_viewers from authenticated, anon, public;
grant select on public.community_live_screen_viewers to authenticated;
grant all on public.community_live_screen_viewers to service_role;

drop policy if exists community_live_hidden_select on public.community_live_hidden_communities;
create policy community_live_hidden_select
  on public.community_live_hidden_communities for select to authenticated
  using (user_id = auth.uid());
drop policy if exists community_live_hidden_insert on public.community_live_hidden_communities;
create policy community_live_hidden_insert
  on public.community_live_hidden_communities for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists community_live_hidden_delete on public.community_live_hidden_communities;
create policy community_live_hidden_delete
  on public.community_live_hidden_communities for delete to authenticated
  using (user_id = auth.uid());
grant select, insert, delete on public.community_live_hidden_communities to authenticated;

drop policy if exists community_live_share_reports_insert on public.community_live_share_reports;
create policy community_live_share_reports_insert
  on public.community_live_share_reports for insert to authenticated
  with check (
    reporter_user_id = auth.uid()
    and exists (
      select 1 from public.community_live_screen_sessions session
      where session.id = session_id and public.can_view_live_screen_session(session)
    )
  );
drop policy if exists community_live_share_reports_select on public.community_live_share_reports;
create policy community_live_share_reports_select
  on public.community_live_share_reports for select to authenticated
  using (
    reporter_user_id = auth.uid()
    or public.has_community_role_level(
      (select community_id from public.community_live_screen_sessions s where s.id = session_id),
      80
    )
  );
grant select, insert on public.community_live_share_reports to authenticated;

create or replace function public.refresh_live_screen_session_viewer_count(target_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_count integer := 0;
  session_row public.community_live_screen_sessions%rowtype;
begin
  select * into session_row from public.community_live_screen_sessions where id = target_session_id for update;
  if not found then return 0; end if;

  delete from public.community_live_screen_viewers
  where session_id = target_session_id
    and last_seen_at < now() - interval '45 seconds';

  select count(*)::integer into next_count
  from public.community_live_screen_viewers
  where session_id = target_session_id
    and viewer_user_id <> session_row.broadcaster_user_id;

  update public.community_live_screen_sessions
  set viewer_count = next_count, updated_at = now()
  where id = target_session_id;

  return next_count;
end;
$$;

revoke all on function public.refresh_live_screen_session_viewer_count(uuid) from public, anon, authenticated;
grant execute on function public.refresh_live_screen_session_viewer_count(uuid) to service_role, authenticated;

create or replace function public.are_users_friends(left_user_id uuid, right_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select left_user_id is not null and right_user_id is not null and exists (
    select 1 from public.friendships friendship
    where friendship.user_low_id = least(left_user_id, right_user_id)
      and friendship.user_high_id = greatest(left_user_id, right_user_id)
  );
$$;

revoke all on function public.are_users_friends(uuid, uuid) from public, anon;
grant execute on function public.are_users_friends(uuid, uuid) to authenticated;

create or replace function public.upsert_community_live_screen_session(
  target_community_id uuid,
  target_channel_id uuid,
  target_livekit_room_name text,
  target_title text default '',
  target_category text default 'other',
  target_application_name text default '',
  target_participant_count integer default 0
)
returns public.community_live_screen_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  channel_row public.channels%rowtype;
  existing public.community_live_screen_sessions%rowtype;
  result_row public.community_live_screen_sessions%rowtype;
  normalized_title text := left(btrim(coalesce(target_title, '')), 160);
  normalized_app text := left(btrim(coalesce(target_application_name, '')), 120);
  normalized_category text := case
    when target_category in ('game', 'chat', 'education', 'watch_together', 'other') then target_category
    else 'other'
  end;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(target_livekit_room_name, ''))) < 8 then
    raise exception 'LIVE_ROOM_INVALID' using errcode = '22023';
  end if;

  select * into channel_row from public.channels where id = target_channel_id;
  if not found or channel_row.community_id <> target_community_id or channel_row.type <> 'voice' then
    raise exception 'LIVE_CHANNEL_INVALID' using errcode = '22023';
  end if;
  if not public.is_active_community_media_member(target_community_id, actor_id) then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;
  if not public.can_view_channel(target_channel_id) then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;

  select * into existing
  from public.community_live_screen_sessions
  where channel_id = target_channel_id and status in ('live', 'reconnecting')
  for update;

  if found then
    if existing.broadcaster_user_id <> actor_id then
      raise exception 'LIVE_SHARE_CONFLICT' using errcode = '23505';
    end if;
    update public.community_live_screen_sessions
    set
      livekit_room_name = btrim(target_livekit_room_name),
      title = coalesce(nullif(normalized_title, ''), title),
      category = normalized_category,
      application_name = coalesce(nullif(normalized_app, ''), application_name),
      status = 'live',
      last_heartbeat_at = now(),
      participant_count = greatest(coalesce(target_participant_count, 0), 0),
      ended_at = null,
      updated_at = now()
    where id = existing.id
    returning * into result_row;
    return result_row;
  end if;

  insert into public.community_live_screen_sessions (
    livekit_room_name, community_id, channel_id, broadcaster_user_id,
    title, category, application_name, status, participant_count
  ) values (
    btrim(target_livekit_room_name), target_community_id, target_channel_id, actor_id,
    normalized_title, normalized_category, normalized_app, 'live',
    greatest(coalesce(target_participant_count, 0), 0)
  )
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.upsert_community_live_screen_session(uuid, uuid, text, text, text, text, integer)
  from public, anon;
grant execute on function public.upsert_community_live_screen_session(uuid, uuid, text, text, text, text, integer)
  to authenticated;

create or replace function public.heartbeat_community_live_screen_session(
  target_session_id uuid,
  target_participant_count integer default null,
  target_status text default 'live'
)
returns public.community_live_screen_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  result_row public.community_live_screen_sessions%rowtype;
  next_status text := case when target_status in ('live', 'reconnecting') then target_status else 'live' end;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;

  update public.community_live_screen_sessions
  set
    status = next_status,
    last_heartbeat_at = now(),
    participant_count = coalesce(target_participant_count, participant_count),
    updated_at = now()
  where id = target_session_id
    and broadcaster_user_id = actor_id
    and status in ('live', 'reconnecting')
  returning * into result_row;

  if not found then raise exception 'LIVE_NOT_FOUND' using errcode = 'P0002'; end if;
  return result_row;
end;
$$;

revoke all on function public.heartbeat_community_live_screen_session(uuid, integer, text) from public, anon;
grant execute on function public.heartbeat_community_live_screen_session(uuid, integer, text) to authenticated;

create or replace function public.end_community_live_screen_session(
  target_session_id uuid,
  target_status text default 'ended'
)
returns public.community_live_screen_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  session_row public.community_live_screen_sessions%rowtype;
  result_row public.community_live_screen_sessions%rowtype;
  next_status text := case when target_status in ('ended', 'terminated') then target_status else 'ended' end;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;

  select * into session_row from public.community_live_screen_sessions where id = target_session_id for update;
  if not found then raise exception 'LIVE_NOT_FOUND' using errcode = 'P0002'; end if;

  if session_row.broadcaster_user_id <> actor_id
    and not public.has_community_role_level(session_row.community_id, 80)
  then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;

  if session_row.status in ('ended', 'terminated') then
    return session_row;
  end if;

  update public.community_live_screen_sessions
  set status = next_status, ended_at = now(), updated_at = now(), viewer_count = 0
  where id = target_session_id
  returning * into result_row;

  delete from public.community_live_screen_viewers where session_id = target_session_id;
  return result_row;
end;
$$;

revoke all on function public.end_community_live_screen_session(uuid, text) from public, anon;
grant execute on function public.end_community_live_screen_session(uuid, text) to authenticated;

create or replace function public.join_community_live_screen_viewer(target_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  session_row public.community_live_screen_sessions%rowtype;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into session_row from public.community_live_screen_sessions where id = target_session_id;
  if not found or not public.can_view_live_screen_session(session_row) then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;
  if session_row.broadcaster_user_id = actor_id then
    return session_row.viewer_count;
  end if;

  insert into public.community_live_screen_viewers(session_id, viewer_user_id, joined_at, last_seen_at)
  values (target_session_id, actor_id, now(), now())
  on conflict (session_id, viewer_user_id) do update
    set last_seen_at = now();

  return public.refresh_live_screen_session_viewer_count(target_session_id);
end;
$$;

revoke all on function public.join_community_live_screen_viewer(uuid) from public, anon;
grant execute on function public.join_community_live_screen_viewer(uuid) to authenticated;

create or replace function public.leave_community_live_screen_viewer(target_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  delete from public.community_live_screen_viewers
  where session_id = target_session_id and viewer_user_id = actor_id;
  return public.refresh_live_screen_session_viewer_count(target_session_id);
end;
$$;

revoke all on function public.leave_community_live_screen_viewer(uuid) from public, anon;
grant execute on function public.leave_community_live_screen_viewer(uuid) to authenticated;

create or replace function public.heartbeat_community_live_screen_viewer(target_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  session_row public.community_live_screen_sessions%rowtype;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into session_row from public.community_live_screen_sessions where id = target_session_id;
  if not found or not public.can_view_live_screen_session(session_row) then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;
  if session_row.broadcaster_user_id = actor_id then
    return session_row.viewer_count;
  end if;

  update public.community_live_screen_viewers
  set last_seen_at = now()
  where session_id = target_session_id and viewer_user_id = actor_id;

  if not found then
    insert into public.community_live_screen_viewers(session_id, viewer_user_id)
    values (target_session_id, actor_id);
  end if;

  return public.refresh_live_screen_session_viewer_count(target_session_id);
end;
$$;

revoke all on function public.heartbeat_community_live_screen_viewer(uuid) from public, anon;
grant execute on function public.heartbeat_community_live_screen_viewer(uuid) to authenticated;

create or replace function public.cleanup_stale_community_live_screen_sessions(
  reconnect_grace_seconds integer default 30,
  heartbeat_stale_seconds integer default 45
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ended_count integer := 0;
begin
  update public.community_live_screen_sessions
  set status = 'reconnecting', updated_at = now()
  where status = 'live'
    and last_heartbeat_at < now() - make_interval(secs => greatest(heartbeat_stale_seconds, 15));

  with ended as (
    update public.community_live_screen_sessions
    set status = 'ended', ended_at = now(), updated_at = now(), viewer_count = 0
    where status in ('live', 'reconnecting')
      and last_heartbeat_at < now() - make_interval(secs => greatest(heartbeat_stale_seconds + reconnect_grace_seconds, 30))
    returning id
  )
  select count(*)::integer into ended_count from ended;

  delete from public.community_live_screen_viewers viewer
  using public.community_live_screen_sessions session
  where viewer.session_id = session.id
    and (
      session.status in ('ended', 'terminated')
      or viewer.last_seen_at < now() - interval '45 seconds'
    );

  return ended_count;
end;
$$;

revoke all on function public.cleanup_stale_community_live_screen_sessions(integer, integer)
  from public, anon, authenticated;
grant execute on function public.cleanup_stale_community_live_screen_sessions(integer, integer)
  to service_role;

create or replace function public.list_visible_live_screen_sessions(
  target_filter text default 'all',
  target_sort text default 'recommended',
  target_limit integer default 48,
  target_cursor_started_at timestamptz default null,
  target_cursor_id uuid default null
)
returns table(
  id uuid,
  livekit_room_name text,
  community_id uuid,
  channel_id uuid,
  broadcaster_user_id uuid,
  title text,
  category text,
  application_name text,
  status text,
  started_at timestamptz,
  ended_at timestamptz,
  viewer_count integer,
  participant_count integer,
  preview_updated_at timestamptz,
  community_name text,
  channel_name text,
  broadcaster_display_name text,
  broadcaster_username text,
  friend_viewer_ids uuid[],
  relevance_score numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  page_limit integer := least(greatest(coalesce(target_limit, 48), 1), 100);
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;

  return query
  with base as (
    select
      session.*,
      community.name as community_name_value,
      channel.name as channel_name_value,
      profile.display_name as broadcaster_display_name_value,
      profile.username as broadcaster_username_value,
      (
        case when public.is_community_member(session.community_id) then 40 else 0 end
        + case when exists (
            select 1 from public.user_follows follow
            where follow.follower_id = actor_id and follow.followed_id = session.broadcaster_user_id
          ) then 25 else 0 end
        + least(session.viewer_count, 50)::numeric
        + case when session.started_at > now() - interval '15 minutes' then 12 else 0 end
        + case when session.status = 'live' then 8 else 0 end
      ) as score_value,
      coalesce((
        select array_agg(viewer.viewer_user_id order by viewer.joined_at)
        from (
          select friend_viewer.viewer_user_id, friend_viewer.joined_at
          from public.community_live_screen_viewers friend_viewer
          where friend_viewer.session_id = session.id
            and public.are_users_friends(actor_id, friend_viewer.viewer_user_id)
          order by friend_viewer.joined_at
          limit 5
        ) viewer
      ), '{}'::uuid[]) as friend_ids
    from public.community_live_screen_sessions session
    join public.communities community on community.id = session.community_id
    join public.channels channel on channel.id = session.channel_id
    join public.profiles profile on profile.id = session.broadcaster_user_id
    where session.status in ('live', 'reconnecting')
      and public.can_view_live_screen_session(session)
      and (
        target_filter = 'all'
        or (target_filter = 'member' and public.is_community_member(session.community_id))
        or (target_filter = 'following' and exists (
          select 1 from public.user_follows follow
          where follow.follower_id = actor_id and follow.followed_id = session.broadcaster_user_id
        ))
        or (target_filter = 'friends_watching' and exists (
          select 1 from public.community_live_screen_viewers viewer
          where viewer.session_id = session.id
            and public.are_users_friends(actor_id, viewer.viewer_user_id)
        ))
        or (target_filter in ('game', 'chat', 'education', 'watch_together', 'other') and session.category = target_filter)
      )
      and (
        target_cursor_started_at is null
        or session.started_at < target_cursor_started_at
        or (session.started_at = target_cursor_started_at and session.id < target_cursor_id)
      )
  )
  select
    base.id,
    base.livekit_room_name,
    base.community_id,
    base.channel_id,
    base.broadcaster_user_id,
    base.title,
    base.category,
    base.application_name,
    base.status,
    base.started_at,
    base.ended_at,
    base.viewer_count,
    base.participant_count,
    base.preview_updated_at,
    base.community_name_value,
    base.channel_name_value,
    base.broadcaster_display_name_value,
    base.broadcaster_username_value,
    base.friend_ids,
    base.score_value
  from base
  order by
    case when target_sort = 'viewers' then base.viewer_count end desc nulls last,
    case when target_sort = 'newest' then extract(epoch from base.started_at) end desc nulls last,
    case when target_sort = 'longest' then extract(epoch from base.started_at) end asc nulls last,
    case when coalesce(target_sort, 'recommended') = 'recommended' then base.score_value end desc nulls last,
    base.started_at desc,
    base.id desc
  limit page_limit;
end;
$$;

revoke all on function public.list_visible_live_screen_sessions(text, text, integer, timestamptz, uuid)
  from public, anon;
grant execute on function public.list_visible_live_screen_sessions(text, text, integer, timestamptz, uuid)
  to authenticated;

create or replace function public.count_visible_live_screen_sessions()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when auth.uid() is null then 0
    else (
      select count(*)::integer
      from public.community_live_screen_sessions session
      where session.status in ('live', 'reconnecting')
        and public.can_view_live_screen_session(session)
    )
  end;
$$;

revoke all on function public.count_visible_live_screen_sessions() from public, anon;
grant execute on function public.count_visible_live_screen_sessions() to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.community_live_screen_sessions;
exception
  when duplicate_object then null;
  when others then null;
end $$;

notify pgrst, 'reload schema';

commit;

