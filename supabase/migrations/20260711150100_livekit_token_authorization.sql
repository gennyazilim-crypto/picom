-- Task 501: authoritative member/private/kind/permission authorization for LiveKit grants.
begin;
create or replace function public.authorize_livekit_room(target_community_id uuid,target_channel_id uuid,target_intent text)
returns table(community_id uuid,channel_id uuid,community_kind text,channel_private boolean,can_publish_audio boolean,can_publish_screen boolean)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare target_community public.communities%rowtype; target_channel public.channels%rowtype; membership public.community_members%rowtype; publish_audio boolean; publish_screen boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if target_intent not in ('voice','screen') then raise exception 'VOICE_INTENT_INVALID' using errcode='22023'; end if;
  select * into target_community from public.communities where id=target_community_id and archived_at is null;
  if target_community.id is null or target_community.kind<>'text'::public.community_kind then raise exception 'VOICE_COMMUNITY_FORBIDDEN' using errcode='42501'; end if;
  select * into membership from public.community_members where community_id=target_community_id and user_id=auth.uid();
  if membership.id is null or exists(select 1 from public.community_bans where community_id=target_community_id and user_id=auth.uid() and revoked_at is null) or exists(select 1 from public.community_member_timeouts where community_id=target_community_id and user_id=auth.uid() and expires_at>now()) then raise exception 'VOICE_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
  select * into target_channel from public.channels where id=target_channel_id and community_id=target_community_id;
  if target_channel.id is null or target_channel.type<>'voice' then raise exception 'VOICE_CHANNEL_FORBIDDEN' using errcode='42501'; end if;
  if not public.effective_community_permission(target_community_id,'viewChannel','channel',target_channel_id) or not public.effective_community_permission(target_community_id,'joinVoice','channel',target_channel_id) then raise exception 'VOICE_CHANNEL_FORBIDDEN' using errcode='42501'; end if;
  if target_channel.is_private and not public.effective_community_permission(target_community_id,'viewPrivateChannels','channel',target_channel_id) then raise exception 'VOICE_PRIVATE_CHANNEL_FORBIDDEN' using errcode='42501'; end if;
  publish_audio:=public.effective_community_permission(target_community_id,'speakInVoice','channel',target_channel_id);
  publish_screen:=public.effective_community_permission(target_community_id,'shareScreen','channel',target_channel_id);
  if target_intent='screen' and not publish_screen then raise exception 'VOICE_SCREEN_SHARE_FORBIDDEN' using errcode='42501'; end if;
  return query select target_community.id,target_channel.id,target_community.kind::text,target_channel.is_private,publish_audio,publish_screen;
end $$;
revoke all on function public.authorize_livekit_room(uuid,uuid,text) from public,anon;
grant execute on function public.authorize_livekit_room(uuid,uuid,text) to authenticated;
comment on function public.authorize_livekit_room(uuid,uuid,text) is 'Returns least-privilege LiveKit capabilities only for active Text-community members with scoped channel permissions. Visitors, bans, active timeouts, private denials, and non-Text kinds are rejected.';
commit;
