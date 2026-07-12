begin;

create or replace function public.is_active_community_media_member(
  target_community_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select target_user_id is not null and exists(
    select 1
    from public.community_members member
    join public.communities community on community.id=member.community_id
    join public.profiles profile on profile.id=member.user_id
    where member.community_id=target_community_id
      and member.user_id=target_user_id
      and community.archived_at is null
      and profile.deletion_requested_at is null
      and not coalesce(profile.is_bot,false)
      and not exists(
        select 1 from public.community_bans ban
        where ban.community_id=member.community_id
          and ban.user_id=member.user_id
          and ban.revoked_at is null
      )
      and not exists(
        select 1 from public.community_member_timeouts timeout
        where timeout.community_id=member.community_id
          and timeout.user_id=member.user_id
          and timeout.expires_at>now()
      )
  );
$$;

create or replace function public.can_view_channel(target_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1
    from public.channels channel
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
        or (
          channel.type='voice'
          and public.community_voice_rooms_enabled(channel.community_id)
          and public.is_active_community_media_member(channel.community_id,auth.uid())
        )
      )
  );
$$;

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
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select
    channel.community_id,
    channel.id,
    channel.name,
    channel.topic,
    channel.is_private,
    true,
    true,
    true
  from public.channels channel
  join public.communities community on community.id=channel.community_id
  where auth.uid() is not null
    and (target_community_id is null or channel.community_id=target_community_id)
    and community.archived_at is null
    and channel.type='voice'
    and public.community_voice_rooms_enabled(channel.community_id)
    and public.is_active_community_media_member(channel.community_id,auth.uid())
  order by channel.community_id,channel.position,channel.id;
$$;

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
  from public.communities
  where id=target_community_id and archived_at is null;
  if target_community.id is null
    or not coalesce(public.community_voice_rooms_enabled(target_community_id),false)
  then
    raise exception 'VOICE_COMMUNITY_FORBIDDEN' using errcode='42501';
  end if;

  if not public.is_active_community_media_member(target_community_id,auth.uid()) then
    raise exception 'VOICE_MEMBERSHIP_REQUIRED' using errcode='42501';
  end if;

  select * into target_channel
  from public.channels
  where id=target_channel_id
    and community_id=target_community_id
    and type='voice';
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

revoke all on function public.is_active_community_media_member(uuid,uuid) from public,anon,authenticated;
revoke all on function public.list_visible_voice_rooms(uuid),public.authorize_livekit_room(uuid,uuid,text) from public,anon;
grant execute on function public.list_visible_voice_rooms(uuid),public.authorize_livekit_room(uuid,uuid,text) to authenticated;
grant execute on function public.can_view_channel(uuid) to anon,authenticated;

comment on function public.is_active_community_media_member(uuid,uuid) is 'Canonical ordinary Voice and Screen access gate: accepted membership, active profile, no active ban, and no active timeout.';
comment on function public.list_visible_voice_rooms(uuid) is 'Returns Voice channel metadata to every active member without role, private-channel, or channel-override restrictions.';
comment on function public.authorize_livekit_room(uuid,uuid,text) is 'Authorizes ordinary Voice and Screen publishing for every active community member; moderation remains role-hierarchy controlled.';

commit;
