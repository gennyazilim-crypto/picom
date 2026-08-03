-- Require active Creator/Publisher program for LiveKit broadcast token minting.

begin;

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
  if not public.user_can_broadcast_on_picom_live(actor_id) then
    raise exception 'PUBLISHER_BROADCAST_NOT_ALLOWED' using errcode = '42501';
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
  if coalesce(session_row.moderation_status, 'approved') <> 'approved' then
    raise exception 'LIVE_BLOCKED' using errcode = '42501';
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

notify pgrst, 'reload schema';

commit;
