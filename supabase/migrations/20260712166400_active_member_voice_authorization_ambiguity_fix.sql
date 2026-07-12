-- Replace the hosted authorization RPC after its RETURNS TABLE community_id
-- output name collided with an unqualified channels.community_id reference.
begin;

create or replace function public.authorize_livekit_room(
  target_community_id uuid,
  target_channel_id uuid,
  target_intent text
)
returns table(
  community_id uuid,
  channel_id uuid,
  community_kind text,
  channel_private boolean,
  can_publish_audio boolean,
  can_publish_screen boolean
)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  target_community public.communities%rowtype;
  target_channel public.channels%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  if target_intent not in ('voice','screen') then
    raise exception 'VOICE_INTENT_INVALID' using errcode='22023';
  end if;

  select * into target_community
  from public.communities community
  where community.id=target_community_id and community.archived_at is null;
  if target_community.id is null
    or not coalesce(public.community_voice_rooms_enabled(target_community_id),false)
  then
    raise exception 'VOICE_COMMUNITY_FORBIDDEN' using errcode='42501';
  end if;

  if not public.is_active_community_media_member(target_community_id,auth.uid()) then
    raise exception 'VOICE_MEMBERSHIP_REQUIRED' using errcode='42501';
  end if;

  select * into target_channel
  from public.channels channel
  where channel.id=target_channel_id
    and channel.community_id=target_community_id
    and channel.type='voice';
  if target_channel.id is null then
    raise exception 'VOICE_CHANNEL_FORBIDDEN' using errcode='42501';
  end if;

  return query select
    target_community.id,
    target_channel.id,
    target_community.kind::text,
    target_channel.is_private,
    true,
    true;
end;
$$;

revoke all on function public.authorize_livekit_room(uuid,uuid,text) from public,anon;
grant execute on function public.authorize_livekit_room(uuid,uuid,text) to authenticated;
comment on function public.authorize_livekit_room(uuid,uuid,text) is 'Active-member Voice and Screen token authorization with fully qualified schema references.';

commit;
