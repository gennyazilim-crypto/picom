-- Fix PL/pgSQL output-column ambiguity in the V1 active-member LiveKit gate.
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
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  target_community public.communities%rowtype;
  target_channel public.channels%rowtype;
  membership public.community_members%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if target_intent not in ('voice','screen') then raise exception 'VOICE_INTENT_INVALID' using errcode='22023'; end if;

  select community.* into target_community
  from public.communities community
  where community.id=target_community_id and community.archived_at is null;
  if target_community.id is null then raise exception 'VOICE_COMMUNITY_FORBIDDEN' using errcode='42501'; end if;

  select member.* into membership
  from public.community_members member
  where member.community_id=target_community_id and member.user_id=auth.uid();
  if membership.id is null
    or exists(select 1 from public.community_bans ban where ban.community_id=target_community_id and ban.user_id=auth.uid() and ban.revoked_at is null)
    or exists(select 1 from public.community_member_timeouts timeout_row where timeout_row.community_id=target_community_id and timeout_row.user_id=auth.uid() and timeout_row.expires_at>now())
  then raise exception 'VOICE_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;

  select channel.* into target_channel
  from public.channels channel
  where channel.id=target_channel_id and channel.community_id=target_community_id and channel.type='voice';
  if target_channel.id is null then raise exception 'VOICE_CHANNEL_FORBIDDEN' using errcode='42501'; end if;

  if target_channel.is_private
    and not public.effective_community_permission(target_community_id,'viewPrivateChannels','channel',target_channel_id)
  then raise exception 'VOICE_PRIVATE_CHANNEL_FORBIDDEN' using errcode='42501'; end if;

  return query
  select target_community.id,target_channel.id,target_community.kind::text,target_channel.is_private,true,true;
end $$;
revoke all on function public.authorize_livekit_room(uuid,uuid,text) from public,anon;
grant execute on function public.authorize_livekit_room(uuid,uuid,text) to authenticated;
commit;
