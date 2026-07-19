-- Task 665: qualify Voice moderation lookups that collide with RETURNS TABLE output names.
begin;

create or replace function public.authorize_livekit_voice_moderation(
  target_community_id uuid,
  target_channel_id uuid,
  target_user_id uuid,
  target_action text
)
returns table(community_id uuid,channel_id uuid,moderated_user_id uuid,action text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  community_record public.communities%rowtype;
  channel_record public.channels%rowtype;
  actor_level integer;
  target_level integer;
  required_permission text;
begin
  if auth.uid() is null or target_user_id=auth.uid() then raise exception 'VOICE_MODERATION_FORBIDDEN' using errcode='42501'; end if;
  if target_action not in ('mute','remove') then raise exception 'VOICE_MODERATION_ACTION_INVALID' using errcode='22023'; end if;

  select community.* into community_record
  from public.communities community
  where community.id=target_community_id and community.archived_at is null and community.kind='text'::public.community_kind;

  select channel.* into channel_record
  from public.channels channel
  where channel.id=target_channel_id and channel.community_id=target_community_id and channel.type='voice';

  if community_record.id is null or channel_record.id is null or not coalesce(public.community_voice_rooms_enabled(target_community_id),false)
  then raise exception 'VOICE_MODERATION_FORBIDDEN' using errcode='42501'; end if;

  if not exists(
    select 1 from public.community_members actor_member
    where actor_member.community_id=target_community_id and actor_member.user_id=auth.uid()
  ) or exists(
    select 1 from public.community_bans actor_ban
    where actor_ban.community_id=target_community_id and actor_ban.user_id=auth.uid() and actor_ban.revoked_at is null
  ) or exists(
    select 1 from public.community_member_timeouts actor_timeout
    where actor_timeout.community_id=target_community_id and actor_timeout.user_id=auth.uid() and actor_timeout.expires_at>now()
  ) then raise exception 'VOICE_MODERATION_FORBIDDEN' using errcode='42501'; end if;

  if not exists(
    select 1 from public.community_members target_member
    where target_member.community_id=target_community_id and target_member.user_id=target_user_id
  ) then raise exception 'VOICE_TARGET_NOT_MEMBER' using errcode='42501'; end if;

  actor_level:=public.community_user_max_role_level(target_community_id,auth.uid());
  target_level:=public.community_user_max_role_level(target_community_id,target_user_id);
  required_permission:=case target_action when 'mute' then 'muteMembers' else 'removeFromVoice' end;

  if actor_level<=target_level or not (
    public.effective_community_permission(target_community_id,required_permission,'channel',target_channel_id)
    or public.effective_community_permission(target_community_id,'manageVoiceRoom','channel',target_channel_id)
  ) then raise exception 'VOICE_ROLE_HIERARCHY_DENIED' using errcode='42501'; end if;

  return query select target_community_id,target_channel_id,target_user_id,target_action;
end;
$$;

revoke all on function public.authorize_livekit_voice_moderation(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.authorize_livekit_voice_moderation(uuid,uuid,uuid,text) to authenticated;
comment on function public.authorize_livekit_voice_moderation(uuid,uuid,uuid,text) is 'Hierarchy-safe Voice moderation with qualified table references; ordinary member media access remains independent.';;
