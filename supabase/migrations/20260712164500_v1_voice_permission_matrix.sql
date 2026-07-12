-- Task 645: canonical V1 Voice permissions, private discovery, and multi-role moderation.
begin;

insert into public.community_permission_definitions(permission_key,category,allowed_kinds,delegable,owner_reserved,description) values
('viewVoiceRoom','voice',array['text'],true,false,'Discover an accessible V1 Text-community voice room.'),
('joinVoiceRoom','voice',array['text'],true,false,'Join an accessible V1 Text-community voice room.')
on conflict(permission_key) do update set category=excluded.category,allowed_kinds=excluded.allowed_kinds,delegable=excluded.delegable,owner_reserved=excluded.owner_reserved,description=excluded.description,updated_at=now();

update public.community_permission_definitions
set allowed_kinds=array['text','radio','podcast'],description='Publish microphone audio in an authorized Voice Room or Meeting.',updated_at=now()
where permission_key='publishAudio';

-- Preserve existing role intent while making the new names authoritative.
insert into public.community_role_permissions(community_id,role_id,permission_key,allowed)
select permission.community_id,permission.role_id,'viewVoiceRoom',permission.allowed
from public.community_role_permissions permission
join public.communities community on community.id=permission.community_id and community.kind='text'::public.community_kind
where permission.permission_key='viewChannel'
on conflict(role_id,permission_key) do nothing;

insert into public.community_role_permissions(community_id,role_id,permission_key,allowed)
select permission.community_id,permission.role_id,'joinVoiceRoom',permission.allowed
from public.community_role_permissions permission
join public.communities community on community.id=permission.community_id and community.kind='text'::public.community_kind
where permission.permission_key='joinVoice'
on conflict(role_id,permission_key) do nothing;

insert into public.community_role_permissions(community_id,role_id,permission_key,allowed)
select distinct on(permission.role_id) permission.community_id,permission.role_id,'publishAudio',permission.allowed
from public.community_role_permissions permission
join public.communities community on community.id=permission.community_id and community.kind='text'::public.community_kind
where permission.permission_key in ('speak','speakInVoice')
order by permission.role_id,case when permission.allowed then 1 else 0 end
on conflict(role_id,permission_key) do nothing;

insert into public.community_role_permissions(community_id,role_id,permission_key,allowed)
select role.community_id,role.id,permission_key,true
from public.roles role
join public.communities community on community.id=role.community_id and community.kind='text'::public.community_kind
cross join lateral unnest(case
  when role.system_key in ('owner','admin') then array['viewVoiceRoom','joinVoiceRoom','publishAudio','shareScreen','muteMembers','removeFromVoice','manageVoiceRoom']::text[]
  when role.system_key='moderator' then array['viewVoiceRoom','joinVoiceRoom','publishAudio','shareScreen','muteMembers','removeFromVoice']::text[]
  when role.system_key='member' then array['viewVoiceRoom','joinVoiceRoom','publishAudio','shareScreen']::text[]
  else array[]::text[] end
) permission_key
on conflict(role_id,permission_key) do nothing;

-- Preserve category/channel overrides. Existing canonical rows win; deny wins when
-- the two legacy microphone aliases disagree.
insert into public.community_permission_overrides(community_id,role_id,scope_type,scope_id,permission_key,effect,created_by)
select override.community_id,override.role_id,override.scope_type,override.scope_id,'viewVoiceRoom',override.effect,override.created_by
from public.community_permission_overrides override
join public.communities community on community.id=override.community_id and community.kind='text'::public.community_kind
where override.permission_key='viewChannel' and override.scope_type in ('category','channel')
on conflict(role_id,scope_type,scope_id,permission_key) do nothing;

insert into public.community_permission_overrides(community_id,role_id,scope_type,scope_id,permission_key,effect,created_by)
select override.community_id,override.role_id,override.scope_type,override.scope_id,'joinVoiceRoom',override.effect,override.created_by
from public.community_permission_overrides override
join public.communities community on community.id=override.community_id and community.kind='text'::public.community_kind
where override.permission_key='joinVoice' and override.scope_type in ('category','channel')
on conflict(role_id,scope_type,scope_id,permission_key) do nothing;

insert into public.community_permission_overrides(community_id,role_id,scope_type,scope_id,permission_key,effect,created_by)
select distinct on(override.role_id,override.scope_type,override.scope_id)
  override.community_id,override.role_id,override.scope_type,override.scope_id,'publishAudio',override.effect,override.created_by
from public.community_permission_overrides override
join public.communities community on community.id=override.community_id and community.kind='text'::public.community_kind
where override.permission_key in ('speak','speakInVoice') and override.scope_type in ('category','channel')
order by override.role_id,override.scope_type,override.scope_id,case when override.effect='deny' then 0 else 1 end
on conflict(role_id,scope_type,scope_id,permission_key) do nothing;

create or replace function public.builtin_role_permission_keys(target_kind text,target_system_key text)
returns text[] language sql stable security definer set search_path=public,pg_temp as $$
  select case
    when target_system_key in ('owner','admin') then coalesce(array(select permission_key from public.community_permission_definitions where target_kind=any(allowed_kinds) order by permission_key),array[]::text[])
    when target_system_key='moderator' then case target_kind
      when 'text' then array['manageMembers','moderateMembers','moderateMessages','deleteAnyMessage','createInvites','viewChannel','sendMessages','uploadAttachments','addReactions','viewVoiceRoom','joinVoiceRoom','publishAudio','shareScreen','muteMembers','removeFromVoice','joinVoice','speak','speakInVoice']
      when 'radio' then array['manageMembers','moderateMembers','moderateMessages','deleteAnyMessage','createInvites','viewRadioContent','listenRadio','moderateRadioComments']
      when 'podcast' then array['manageMembers','moderateMembers','moderateMessages','deleteAnyMessage','createInvites','viewPodcastContent','listenPodcasts','moderatePodcastEpisodes','commentOnPodcasts','reactToPodcasts','moderatePodcastComments'] end
    when target_system_key='member' then case target_kind
      when 'text' then array['viewChannel','sendMessages','uploadAttachments','addReactions','viewVoiceRoom','joinVoiceRoom','publishAudio','shareScreen','joinVoice','speak','speakInVoice']
      when 'radio' then array['viewRadioContent','listenRadio']
      when 'podcast' then array['viewPodcastContent','listenPodcasts','commentOnPodcasts','reactToPodcasts'] end
    else array[]::text[] end;
$$;

-- Public content access never implies Voice Room discovery.
create or replace function public.can_read_public_channel(target_channel_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.channels channel
    join public.communities community on community.id=channel.community_id
    where channel.id=target_channel_id
      and channel.type<>'voice'
      and community.archived_at is null
      and community.visibility='public'
      and community.public_read_enabled=true
      and channel.is_private=false
      and channel.public_read_enabled=true
  );
$$;

create or replace function public.can_view_channel(target_channel_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.channels channel
    join public.communities community on community.id=channel.community_id
    where channel.id=target_channel_id
      and community.archived_at is null
      and (
        (channel.type<>'voice' and (
          public.can_read_public_channel(channel.id)
          or (
            public.is_community_member(channel.community_id)
            and (not channel.is_private or public.is_community_owner(channel.community_id) or public.has_community_role_level(channel.community_id,80))
          )
        ))
        or
        (channel.type='voice'
          and auth.uid() is not null
          and community.kind='text'::public.community_kind
          and public.is_community_member(channel.community_id)
          and public.community_voice_rooms_enabled(channel.community_id)
          and not exists(select 1 from public.community_bans ban where ban.community_id=channel.community_id and ban.user_id=auth.uid() and ban.revoked_at is null)
          and not exists(select 1 from public.community_member_timeouts timeout where timeout.community_id=channel.community_id and timeout.user_id=auth.uid() and timeout.expires_at>now())
          and public.effective_community_permission(channel.community_id,'viewVoiceRoom','channel',channel.id)
          and (not channel.is_private or public.effective_community_permission(channel.community_id,'viewPrivateChannels','channel',channel.id))
        )
      )
  );
$$;

drop policy if exists "channels_select_visible_to_member_or_public" on public.channels;
create policy "channels_select_visible_to_member_or_public"
on public.channels for select to anon,authenticated
using(public.can_view_channel(id));

create or replace function public.list_visible_voice_rooms(target_community_id uuid default null)
returns table(
  community_id uuid,
  channel_id uuid,
  channel_name text,
  channel_topic text,
  channel_private boolean,
  can_join boolean,
  can_publish_audio boolean,
  can_share_screen boolean
)
language sql stable security definer set search_path=public,pg_temp as $$
  select channel.community_id,channel.id,channel.name,channel.topic,channel.is_private,
    public.effective_community_permission(channel.community_id,'joinVoiceRoom','channel',channel.id),
    public.effective_community_permission(channel.community_id,'publishAudio','channel',channel.id),
    public.effective_community_permission(channel.community_id,'shareScreen','channel',channel.id)
  from public.channels channel
  join public.communities community on community.id=channel.community_id
  where auth.uid() is not null
    and (target_community_id is null or channel.community_id=target_community_id)
    and community.kind='text'::public.community_kind
    and community.archived_at is null
    and channel.type='voice'
    and public.is_community_member(channel.community_id)
    and public.community_voice_rooms_enabled(channel.community_id)
    and not exists(select 1 from public.community_bans ban where ban.community_id=channel.community_id and ban.user_id=auth.uid() and ban.revoked_at is null)
    and not exists(select 1 from public.community_member_timeouts timeout where timeout.community_id=channel.community_id and timeout.user_id=auth.uid() and timeout.expires_at>now())
    and public.effective_community_permission(channel.community_id,'viewVoiceRoom','channel',channel.id)
    and (not channel.is_private or public.effective_community_permission(channel.community_id,'viewPrivateChannels','channel',channel.id))
  order by channel.community_id,channel.position,channel.id;
$$;

create or replace function public.authorize_livekit_room(target_community_id uuid,target_channel_id uuid,target_intent text)
returns table(community_id uuid,channel_id uuid,community_kind text,channel_private boolean,can_publish_audio boolean,can_publish_screen boolean)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare target_community public.communities%rowtype; target_channel public.channels%rowtype; membership public.community_members%rowtype; publish_audio boolean; publish_screen boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if target_intent not in ('voice','screen') then raise exception 'VOICE_INTENT_INVALID' using errcode='22023'; end if;
  select * into target_community from public.communities where id=target_community_id and archived_at is null;
  if target_community.id is null or target_community.kind<>'text'::public.community_kind or not coalesce(public.community_voice_rooms_enabled(target_community_id),false) then raise exception 'VOICE_COMMUNITY_FORBIDDEN' using errcode='42501'; end if;
  select * into membership from public.community_members where community_id=target_community_id and user_id=auth.uid();
  if membership.id is null
    or exists(select 1 from public.community_bans where community_id=target_community_id and user_id=auth.uid() and revoked_at is null)
    or exists(select 1 from public.community_member_timeouts where community_id=target_community_id and user_id=auth.uid() and expires_at>now())
  then raise exception 'VOICE_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
  select * into target_channel from public.channels where id=target_channel_id and community_id=target_community_id;
  if target_channel.id is null or target_channel.type<>'voice' then raise exception 'VOICE_CHANNEL_FORBIDDEN' using errcode='42501'; end if;
  if not public.effective_community_permission(target_community_id,'viewVoiceRoom','channel',target_channel_id)
    or not public.effective_community_permission(target_community_id,'joinVoiceRoom','channel',target_channel_id)
  then raise exception 'VOICE_CHANNEL_FORBIDDEN' using errcode='42501'; end if;
  if target_channel.is_private and not public.effective_community_permission(target_community_id,'viewPrivateChannels','channel',target_channel_id) then raise exception 'VOICE_PRIVATE_CHANNEL_FORBIDDEN' using errcode='42501'; end if;
  publish_audio:=public.effective_community_permission(target_community_id,'publishAudio','channel',target_channel_id);
  publish_screen:=public.effective_community_permission(target_community_id,'shareScreen','channel',target_channel_id);
  if target_intent='screen' and not publish_screen then raise exception 'VOICE_SCREEN_SHARE_FORBIDDEN' using errcode='42501'; end if;
  return query select target_community.id,target_channel.id,target_community.kind::text,target_channel.is_private,publish_audio,publish_screen;
end;
$$;

create or replace function public.community_user_max_role_level(target_community_id uuid,target_user_id uuid)
returns integer language sql stable security definer set search_path=public,pg_temp as $$
  select case
    when exists(select 1 from public.communities where id=target_community_id and owner_id=target_user_id) then 32767
    else coalesce((
      select max(role.level)
      from public.community_members member
      join public.roles role on role.community_id=member.community_id and (
        role.id=member.role_id
        or exists(select 1 from public.community_member_roles link where link.member_id=member.id and link.role_id=role.id)
      )
      where member.community_id=target_community_id and member.user_id=target_user_id
    ),-1)
  end;
$$;

create or replace function public.authorize_livekit_voice_moderation(target_community_id uuid,target_channel_id uuid,target_user_id uuid,target_action text)
returns table(community_id uuid,channel_id uuid,moderated_user_id uuid,action text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare community_record public.communities%rowtype; channel_record public.channels%rowtype; actor_level integer; target_level integer; required_permission text;
begin
  if auth.uid() is null or target_user_id=auth.uid() then raise exception 'VOICE_MODERATION_FORBIDDEN' using errcode='42501'; end if;
  if target_action not in ('mute','remove') then raise exception 'VOICE_MODERATION_ACTION_INVALID' using errcode='22023'; end if;
  select * into community_record from public.communities where id=target_community_id and archived_at is null and kind='text'::public.community_kind;
  select * into channel_record from public.channels where id=target_channel_id and community_id=target_community_id and type='voice';
  if community_record.id is null or channel_record.id is null or not coalesce(public.community_voice_rooms_enabled(target_community_id),false) then raise exception 'VOICE_MODERATION_FORBIDDEN' using errcode='42501'; end if;
  if not exists(select 1 from public.community_members where community_id=target_community_id and user_id=auth.uid())
    or exists(select 1 from public.community_bans where community_id=target_community_id and user_id=auth.uid() and revoked_at is null)
    or exists(select 1 from public.community_member_timeouts where community_id=target_community_id and user_id=auth.uid() and expires_at>now())
  then raise exception 'VOICE_MODERATION_FORBIDDEN' using errcode='42501'; end if;
  if not exists(select 1 from public.community_members where community_id=target_community_id and user_id=target_user_id) then raise exception 'VOICE_TARGET_NOT_MEMBER' using errcode='42501'; end if;
  actor_level:=public.community_user_max_role_level(target_community_id,auth.uid());
  target_level:=public.community_user_max_role_level(target_community_id,target_user_id);
  required_permission:=case target_action when 'mute' then 'muteMembers' else 'removeFromVoice' end;
  if actor_level<=target_level
    or not (
      public.effective_community_permission(target_community_id,required_permission,'channel',target_channel_id)
      or public.effective_community_permission(target_community_id,'manageVoiceRoom','channel',target_channel_id)
    )
  then raise exception 'VOICE_ROLE_HIERARCHY_DENIED' using errcode='42501'; end if;
  return query select target_community_id,target_channel_id,target_user_id,target_action;
end;
$$;

revoke all on function public.list_visible_voice_rooms(uuid),public.community_user_max_role_level(uuid,uuid),public.authorize_livekit_room(uuid,uuid,text),public.authorize_livekit_voice_moderation(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.list_visible_voice_rooms(uuid),public.authorize_livekit_room(uuid,uuid,text),public.authorize_livekit_voice_moderation(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.can_read_public_channel(uuid),public.can_view_channel(uuid) to anon,authenticated;

comment on function public.list_visible_voice_rooms(uuid) is 'Returns only safe Voice channel metadata and caller capabilities; never participants or history.';
comment on function public.authorize_livekit_room(uuid,uuid,text) is 'Canonical V1 Text-community Voice authorization using viewVoiceRoom, joinVoiceRoom, publishAudio, and shareScreen.';
comment on function public.authorize_livekit_voice_moderation(uuid,uuid,uuid,text) is 'Multi-role hierarchy-safe V1 Voice mute/remove authorization.';

commit;
