-- Task 506: type-aware voice-room permissions and hierarchy-safe LiveKit moderation.
begin;
update public.communities set type_settings=jsonb_set(coalesce(type_settings,'{}'::jsonb),'{voiceRoomsEnabled}',to_jsonb(kind='text'::public.community_kind),true) where not coalesce(type_settings,'{}'::jsonb)?'voiceRoomsEnabled';

insert into public.community_permission_definitions(permission_key,category,allowed_kinds,delegable,owner_reserved,description) values
('speak','voice',array['text','radio','podcast'],true,false,'Publish microphone audio in a configured voice room.'),
('muteMembers','voice',array['text','radio','podcast'],true,false,'Server-mute lower-ranked voice participants.'),
('removeFromVoice','voice',array['text','radio','podcast'],true,false,'Remove lower-ranked participants from a voice room.'),
('manageVoiceRoom','voice',array['text','radio','podcast'],true,false,'Manage configured voice rooms and participants.')
on conflict(permission_key) do update set category=excluded.category,allowed_kinds=excluded.allowed_kinds,delegable=excluded.delegable,owner_reserved=excluded.owner_reserved,description=excluded.description,updated_at=now();
update public.community_permission_definitions set allowed_kinds=array['text','radio','podcast'],updated_at=now() where permission_key in ('joinVoice','speakInVoice','shareScreen','viewPrivateChannels');

insert into public.community_role_permissions(community_id,role_id,permission_key,allowed) select community_id,role_id,'speak',allowed from public.community_role_permissions where permission_key='speakInVoice' on conflict(role_id,permission_key) do nothing;
insert into public.community_role_permissions(community_id,role_id,permission_key,allowed)
select role.community_id,role.id,permission_key,true from public.roles role cross join lateral unnest(case when role.system_key in ('owner','admin') then array['joinVoice','speak','speakInVoice','shareScreen','muteMembers','removeFromVoice','manageVoiceRoom','viewPrivateChannels']::text[] when role.system_key='moderator' then array['joinVoice','speak','speakInVoice','shareScreen','muteMembers','removeFromVoice']::text[] when role.system_key='member' then array['joinVoice','speak','speakInVoice','shareScreen']::text[] else array[]::text[] end) permission_key on conflict(role_id,permission_key) do nothing;

create or replace function public.community_voice_rooms_enabled(target_community_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select case when jsonb_typeof(coalesce(type_settings,'{}'::jsonb)->'voiceRoomsEnabled')='boolean' then (type_settings->>'voiceRoomsEnabled')::boolean else kind='text'::public.community_kind end from public.communities where id=target_community_id and archived_at is null; $$;

create or replace function public.authorize_livekit_room(target_community_id uuid,target_channel_id uuid,target_intent text)
returns table(community_id uuid,channel_id uuid,community_kind text,channel_private boolean,can_publish_audio boolean,can_publish_screen boolean)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare target_community public.communities%rowtype; target_channel public.channels%rowtype; membership public.community_members%rowtype; publish_audio boolean; publish_screen boolean; can_view boolean;
begin
if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
if target_intent not in ('voice','screen') then raise exception 'VOICE_INTENT_INVALID' using errcode='22023'; end if;
select * into target_community from public.communities where id=target_community_id and archived_at is null;
if target_community.id is null or not coalesce(public.community_voice_rooms_enabled(target_community_id),false) then raise exception 'VOICE_COMMUNITY_FORBIDDEN' using errcode='42501'; end if;
select * into membership from public.community_members where community_id=target_community_id and user_id=auth.uid();
if membership.id is null or exists(select 1 from public.community_bans where community_id=target_community_id and user_id=auth.uid() and revoked_at is null) or exists(select 1 from public.community_member_timeouts where community_id=target_community_id and user_id=auth.uid() and expires_at>now()) then raise exception 'VOICE_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
select * into target_channel from public.channels where id=target_channel_id and community_id=target_community_id;
if target_channel.id is null or target_channel.type<>'voice' then raise exception 'VOICE_CHANNEL_FORBIDDEN' using errcode='42501'; end if;
can_view:=case target_community.kind when 'radio' then public.effective_community_permission(target_community_id,'viewRadioContent',null,null) when 'podcast' then public.effective_community_permission(target_community_id,'viewPodcastContent',null,null) else public.effective_community_permission(target_community_id,'viewChannel','channel',target_channel_id) end;
if not can_view or not public.effective_community_permission(target_community_id,'joinVoice','channel',target_channel_id) then raise exception 'VOICE_CHANNEL_FORBIDDEN' using errcode='42501'; end if;
if target_channel.is_private and not public.effective_community_permission(target_community_id,'viewPrivateChannels','channel',target_channel_id) then raise exception 'VOICE_PRIVATE_CHANNEL_FORBIDDEN' using errcode='42501'; end if;
publish_audio:=public.effective_community_permission(target_community_id,'speak','channel',target_channel_id) or public.effective_community_permission(target_community_id,'speakInVoice','channel',target_channel_id);
publish_screen:=public.effective_community_permission(target_community_id,'shareScreen','channel',target_channel_id);
if target_intent='screen' and not publish_screen then raise exception 'VOICE_SCREEN_SHARE_FORBIDDEN' using errcode='42501'; end if;
return query select target_community.id,target_channel.id,target_community.kind::text,target_channel.is_private,publish_audio,publish_screen;
end $$;

create or replace function public.authorize_livekit_voice_moderation(target_community_id uuid,target_channel_id uuid,target_user_id uuid,target_action text)
returns table(community_id uuid,channel_id uuid,moderated_user_id uuid,action text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare community_record public.communities%rowtype; channel_record public.channels%rowtype; actor_role public.roles%rowtype; target_role public.roles%rowtype; actor_level integer; target_level integer; required_permission text;
begin
if auth.uid() is null or target_user_id=auth.uid() then raise exception 'VOICE_MODERATION_FORBIDDEN' using errcode='42501'; end if;
if target_action not in ('mute','remove') then raise exception 'VOICE_MODERATION_ACTION_INVALID' using errcode='22023'; end if;
select * into community_record from public.communities where id=target_community_id and archived_at is null;
select * into channel_record from public.channels where id=target_channel_id and community_id=target_community_id and type='voice';
if community_record.id is null or channel_record.id is null or not coalesce(public.community_voice_rooms_enabled(target_community_id),false) then raise exception 'VOICE_MODERATION_FORBIDDEN' using errcode='42501'; end if;
if not exists(select 1 from public.community_members where community_id=target_community_id and user_id=target_user_id) then raise exception 'VOICE_TARGET_NOT_MEMBER' using errcode='42501'; end if;
if exists(select 1 from public.community_bans where community_id=target_community_id and user_id=auth.uid() and revoked_at is null) then raise exception 'VOICE_MODERATION_FORBIDDEN' using errcode='42501'; end if;
select role.* into actor_role from public.community_members member join public.roles role on role.id=member.role_id where member.community_id=target_community_id and member.user_id=auth.uid();
select role.* into target_role from public.community_members member join public.roles role on role.id=member.role_id where member.community_id=target_community_id and member.user_id=target_user_id;
actor_level:=case when community_record.owner_id=auth.uid() then 32767 else coalesce(actor_role.level,-1) end;
target_level:=case when community_record.owner_id=target_user_id then 32767 else coalesce(target_role.level,0) end;
required_permission:=case target_action when 'mute' then 'muteMembers' else 'removeFromVoice' end;
if actor_level<=target_level or not (public.effective_community_permission(target_community_id,required_permission,'channel',target_channel_id) or public.effective_community_permission(target_community_id,'manageVoiceRoom','channel',target_channel_id)) then raise exception 'VOICE_ROLE_HIERARCHY_DENIED' using errcode='42501'; end if;
return query select target_community_id,target_channel_id,target_user_id,target_action;
end $$;

create or replace function public.record_livekit_voice_moderation(target_community_id uuid,target_channel_id uuid,target_user_id uuid,target_action text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$ declare audit_id uuid; begin perform 1 from public.authorize_livekit_voice_moderation(target_community_id,target_channel_id,target_user_id,target_action); insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason) values(target_community_id,auth.uid(),'moderation_action','voice_participant',target_user_id,left('voice_'||target_action||':'||target_channel_id::text,500)) returning id into audit_id; return audit_id; end $$;
revoke all on function public.community_voice_rooms_enabled(uuid),public.authorize_livekit_room(uuid,uuid,text),public.authorize_livekit_voice_moderation(uuid,uuid,uuid,text),public.record_livekit_voice_moderation(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.authorize_livekit_room(uuid,uuid,text),public.authorize_livekit_voice_moderation(uuid,uuid,uuid,text),public.record_livekit_voice_moderation(uuid,uuid,uuid,text) to authenticated;
comment on function public.authorize_livekit_room(uuid,uuid,text) is 'Least-privilege normal voice grants for active members; Radio broadcast grants are intentionally unrelated.';
comment on function public.authorize_livekit_voice_moderation(uuid,uuid,uuid,text) is 'Mute/remove authorization limited to lower-ranked active members.';;
