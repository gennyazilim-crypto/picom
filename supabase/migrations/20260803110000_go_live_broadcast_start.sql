-- Go Live: startingâ†’live broadcast start, idempotency, broadcast LiveKit auth.
-- Visibility remains channel/community ACL; starting sessions never appear on Live Now.

begin;

alter table public.community_live_screen_sessions
  drop constraint if exists community_live_screen_sessions_status_check;

alter table public.community_live_screen_sessions
  add constraint community_live_screen_sessions_status_check
  check (status in ('starting', 'live', 'reconnecting', 'ended', 'terminated'));

alter table public.community_live_screen_sessions
  add column if not exists client_request_id uuid;

alter table public.community_live_screen_sessions
  add column if not exists description text not null default ''
    check (char_length(description) <= 2000);

alter table public.community_live_screen_sessions
  add column if not exists language_code text not null default ''
    check (char_length(language_code) <= 16);

alter table public.community_live_screen_sessions
  add column if not exists visibility_mode text not null default 'channel_members'
    check (visibility_mode in ('channel_members', 'community_members', 'public_discovery'));

create unique index if not exists community_live_screen_sessions_client_request_uidx
  on public.community_live_screen_sessions(client_request_id)
  where client_request_id is not null;

drop index if exists community_live_screen_sessions_active_channel_uidx;
create unique index community_live_screen_sessions_active_channel_uidx
  on public.community_live_screen_sessions(channel_id)
  where status in ('starting', 'live', 'reconnecting');

create index if not exists community_live_screen_sessions_starting_idx
  on public.community_live_screen_sessions(status, updated_at)
  where status = 'starting';

create or replace function public.normalize_live_broadcast_title(raw text)
returns text
language sql
immutable
as $$
  select left(btrim(regexp_replace(coalesce(raw, ''), E'[\\u0000-\\u001f\\u007f]', '', 'g')), 160);
$$;

revoke all on function public.normalize_live_broadcast_title(text) from public, anon;
grant execute on function public.normalize_live_broadcast_title(text) to authenticated;

create or replace function public.list_go_live_broadcast_targets()
returns table (
  community_id uuid,
  community_name text,
  community_kind text,
  community_visibility text,
  channel_id uuid,
  channel_name text,
  channel_private boolean,
  can_publish_screen boolean,
  can_publish_audio boolean
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
    community.id,
    community.name,
    community.kind::text,
    coalesce(community.visibility::text, 'private'),
    channel.id,
    channel.name,
    coalesce(channel.is_private, false),
    public.effective_community_permission(community.id, 'shareScreen', 'channel', channel.id),
    public.effective_community_permission(community.id, 'speakInVoice', 'channel', channel.id)
  from public.community_members membership
  join public.communities community on community.id = membership.community_id
  join public.channels channel on channel.community_id = community.id
  where membership.user_id = actor_id
    and channel.type = 'voice'
    and public.is_active_community_media_member(community.id, actor_id)
    and public.can_view_channel(channel.id)
    and public.effective_community_permission(community.id, 'shareScreen', 'channel', channel.id)
  order by community.name asc, channel.name asc;
end;
$$;

revoke all on function public.list_go_live_broadcast_targets() from public, anon;
grant execute on function public.list_go_live_broadcast_targets() to authenticated;

comment on function public.list_go_live_broadcast_targets() is
  'Lists voice channels where the JWT subject may start a Go Live screen broadcast.';

create or replace function public.start_community_live_screen_broadcast(
  target_community_id uuid,
  target_channel_id uuid,
  target_client_request_id uuid,
  target_title text,
  target_category text default 'other',
  target_application_name text default '',
  target_description text default '',
  target_language_code text default '',
  target_visibility_mode text default 'channel_members'
)
returns public.community_live_screen_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  channel_row public.channels%rowtype;
  community_row public.communities%rowtype;
  existing public.community_live_screen_sessions%rowtype;
  result_row public.community_live_screen_sessions%rowtype;
  normalized_title text := public.normalize_live_broadcast_title(target_title);
  normalized_app text := left(btrim(regexp_replace(coalesce(target_application_name, ''), E'[\\u0000-\\u001f\\u007f]', '', 'g')), 120);
  normalized_description text := left(btrim(regexp_replace(coalesce(target_description, ''), E'[\\u0000-\\u001f\\u007f]', '', 'g')), 2000);
  normalized_language text := left(btrim(lower(coalesce(target_language_code, ''))), 16);
  normalized_category text := case
    when target_category in ('game', 'chat', 'education', 'watch_together', 'other') then target_category
    else 'other'
  end;
  normalized_visibility text := case
    when target_visibility_mode in ('channel_members', 'community_members', 'public_discovery') then target_visibility_mode
    else 'channel_members'
  end;
  room_name text;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if target_client_request_id is null then raise exception 'VALIDATION_ERROR' using errcode = '22023'; end if;
  if char_length(normalized_title) < 1 then raise exception 'VALIDATION_ERROR' using errcode = '22023'; end if;

  select * into existing
  from public.community_live_screen_sessions
  where client_request_id = target_client_request_id
  limit 1;
  if found then
    if existing.broadcaster_user_id <> actor_id then
      raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
    end if;
    return existing;
  end if;

  select * into channel_row from public.channels where id = target_channel_id;
  if not found or channel_row.community_id <> target_community_id or channel_row.type <> 'voice' then
    raise exception 'LIVE_CHANNEL_INVALID' using errcode = '22023';
  end if;

  select * into community_row from public.communities where id = target_community_id;
  if not found then raise exception 'LIVE_CHANNEL_INVALID' using errcode = '22023'; end if;

  if not public.is_active_community_media_member(target_community_id, actor_id) then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;
  if not public.can_view_channel(target_channel_id) then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;
  if not public.effective_community_permission(target_community_id, 'shareScreen', 'channel', target_channel_id) then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;

  if normalized_visibility = 'public_discovery'
     and coalesce(community_row.visibility::text, 'private') <> 'public' then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;
  if normalized_visibility = 'community_members' and coalesce(channel_row.is_private, false) then
    -- Private channel cannot escalate visibility beyond channel ACL.
    normalized_visibility := 'channel_members';
  end if;

  select * into existing
  from public.community_live_screen_sessions
  where channel_id = target_channel_id
    and status in ('starting', 'live', 'reconnecting')
  for update;
  if found then
    if existing.broadcaster_user_id = actor_id and existing.client_request_id = target_client_request_id then
      return existing;
    end if;
    raise exception 'LIVE_SHARE_CONFLICT' using errcode = '23505';
  end if;

  -- Also block concurrent starting/live by same broadcaster in another channel.
  if exists (
    select 1 from public.community_live_screen_sessions
    where broadcaster_user_id = actor_id
      and status in ('starting', 'live', 'reconnecting')
  ) then
    raise exception 'LIVE_SHARE_CONFLICT' using errcode = '23505';
  end if;

  room_name := 'community:' || target_community_id::text || ':voice:' || target_channel_id::text;

  insert into public.community_live_screen_sessions (
    livekit_room_name, community_id, channel_id, broadcaster_user_id,
    title, category, application_name, description, language_code, visibility_mode,
    status, client_request_id, participant_count, last_heartbeat_at
  ) values (
    room_name, target_community_id, target_channel_id, actor_id,
    normalized_title, normalized_category, normalized_app, normalized_description,
    normalized_language, normalized_visibility,
    'starting', target_client_request_id, 0, now()
  )
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.start_community_live_screen_broadcast(uuid, uuid, uuid, text, text, text, text, text, text)
  from public, anon;
grant execute on function public.start_community_live_screen_broadcast(uuid, uuid, uuid, text, text, text, text, text, text)
  to authenticated;

create or replace function public.confirm_community_live_screen_broadcast(target_session_id uuid)
returns public.community_live_screen_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  session_row public.community_live_screen_sessions%rowtype;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;

  select * into session_row
  from public.community_live_screen_sessions
  where id = target_session_id
  for update;
  if not found then raise exception 'LIVE_NOT_FOUND' using errcode = 'P0002'; end if;
  if session_row.broadcaster_user_id <> actor_id then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;
  if session_row.status = 'live' then
    return session_row;
  end if;
  if session_row.status <> 'starting' then
    raise exception 'LIVE_CHANNEL_INVALID' using errcode = '22023';
  end if;

  update public.community_live_screen_sessions
  set status = 'live',
      started_at = coalesce(started_at, now()),
      last_heartbeat_at = now(),
      ended_at = null,
      updated_at = now()
  where id = session_row.id
  returning * into session_row;

  return session_row;
end;
$$;

revoke all on function public.confirm_community_live_screen_broadcast(uuid) from public, anon;
grant execute on function public.confirm_community_live_screen_broadcast(uuid) to authenticated;

create or replace function public.abort_community_live_screen_broadcast(target_session_id uuid)
returns public.community_live_screen_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  session_row public.community_live_screen_sessions%rowtype;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;

  select * into session_row
  from public.community_live_screen_sessions
  where id = target_session_id
  for update;
  if not found then raise exception 'LIVE_NOT_FOUND' using errcode = 'P0002'; end if;
  if session_row.broadcaster_user_id <> actor_id
     and not public.has_community_role_level(session_row.community_id, 80) then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;
  if session_row.status not in ('starting', 'live', 'reconnecting') then
    return session_row;
  end if;

  update public.community_live_screen_sessions
  set status = 'ended',
      ended_at = now(),
      updated_at = now(),
      viewer_count = 0
  where id = session_row.id
  returning * into session_row;

  delete from public.community_live_screen_viewers where session_id = session_row.id;
  return session_row;
end;
$$;

revoke all on function public.abort_community_live_screen_broadcast(uuid) from public, anon;
grant execute on function public.abort_community_live_screen_broadcast(uuid) to authenticated;

create or replace function public.authorize_live_broadcast_livekit(target_session_id uuid)
returns table (
  session_id uuid,
  community_id uuid,
  channel_id uuid,
  livekit_room_name text,
  broadcaster_user_id uuid,
  can_publish_audio boolean,
  can_publish_video boolean,
  can_publish_screen boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  session_row public.community_live_screen_sessions%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into session_row
  from public.community_live_screen_sessions session
  where session.id = target_session_id;

  if not found then
    raise exception 'LIVE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if session_row.broadcaster_user_id <> actor_id then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;
  if session_row.status not in ('starting', 'live', 'reconnecting') then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;
  if not public.is_active_community_media_member(session_row.community_id, actor_id) then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;
  if not public.can_view_channel(session_row.channel_id) then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;
  if not public.effective_community_permission(session_row.community_id, 'shareScreen', 'channel', session_row.channel_id) then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select
    session_row.id,
    session_row.community_id,
    session_row.channel_id,
    session_row.livekit_room_name,
    session_row.broadcaster_user_id,
    public.effective_community_permission(session_row.community_id, 'speakInVoice', 'channel', session_row.channel_id),
    false,
    true;
end;
$$;

revoke all on function public.authorize_live_broadcast_livekit(uuid) from public, anon;
grant execute on function public.authorize_live_broadcast_livekit(uuid) to authenticated;

comment on function public.authorize_live_broadcast_livekit(uuid) is
  'Authorizes the owning broadcaster to publish screen (+ optional mic) for a Go Live session.';

create or replace function public.expire_stale_starting_live_screen_sessions(max_age_seconds integer default 120)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected integer := 0;
begin
  update public.community_live_screen_sessions
  set status = 'ended',
      ended_at = now(),
      updated_at = now()
  where status = 'starting'
    and updated_at < now() - make_interval(secs => greatest(coalesce(max_age_seconds, 120), 30));
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.expire_stale_starting_live_screen_sessions(integer) from public, anon, authenticated;
grant execute on function public.expire_stale_starting_live_screen_sessions(integer) to service_role;

commit;

