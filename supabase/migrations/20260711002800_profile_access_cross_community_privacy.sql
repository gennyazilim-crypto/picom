begin;

-- Keep the client-facing v3 signature while making every access decision in
-- one explicit boundary. Security-definer reads must never inherit an older
-- helper's broader assumptions.
create or replace function public.get_profile_privacy_projection_v3(target_user_id uuid)
returns table(
  profile_visibility text,
  can_view_profile boolean,
  show_online_status boolean,
  show_location boolean,
  show_timezone boolean,
  show_activity boolean,
  show_media boolean,
  show_communities boolean,
  show_friends boolean,
  show_follows boolean,
  show_audio boolean,
  location text,
  timezone text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  settings public.profile_privacy_settings%rowtype;
  target_exists boolean := false;
  owner_view boolean := auth.uid() = target_user_id;
  blocked_access boolean := false;
  shared_access boolean := false;
  friend_access boolean := false;
  trusted_access boolean := false;
  allowed boolean := false;
begin
  if auth.uid() is null or target_user_id is null then
    return query select 'friends'::text, false, false, false, false, false, false, false, false, false, false, null::text, null::text;
    return;
  end if;

  select exists(select 1 from public.profiles profile where profile.id = target_user_id) into target_exists;
  if not target_exists then
    return query select 'friends'::text, false, false, false, false, false, false, false, false, false, false, null::text, null::text;
    return;
  end if;

  select * into settings from public.profile_privacy_settings where user_id = target_user_id;
  if settings.user_id is null then
    settings.profile_visibility := 'everyone';
    settings.show_online_status := true;
    settings.show_location := true;
    settings.show_timezone := true;
    settings.show_activity := true;
    settings.show_media := true;
    settings.show_communities := true;
    settings.show_friends := true;
    settings.show_follows := true;
    settings.show_audio := true;
  end if;

  blocked_access := public.users_are_blocked(auth.uid(), target_user_id);
  shared_access := exists(
    select 1
    from public.community_members viewer
    join public.community_members target on target.community_id = viewer.community_id
    where viewer.user_id = auth.uid() and target.user_id = target_user_id
  );
  friend_access := public.are_friends(auth.uid(), target_user_id);
  trusted_access := owner_view or shared_access or friend_access;
  allowed := owner_view or (
    not blocked_access and (
      settings.profile_visibility = 'everyone'
      or (settings.profile_visibility = 'shared_communities' and shared_access)
      or (settings.profile_visibility = 'friends' and friend_access)
    )
  );

  return query select
    settings.profile_visibility,
    allowed,
    allowed and (owner_view or settings.show_online_status),
    allowed and settings.show_location,
    allowed and settings.show_timezone,
    allowed and settings.show_activity and trusted_access,
    allowed and settings.show_media and trusted_access,
    allowed and settings.show_communities and trusted_access,
    allowed and settings.show_friends and trusted_access,
    allowed and settings.show_follows and trusted_access,
    allowed and settings.show_audio,
    case when allowed and settings.show_location then settings.location end,
    case when allowed and settings.show_timezone then settings.timezone end;
end;
$$;

-- Public verification markers follow the same subject visibility boundary.
-- Request/review metadata remains governed by its owner/reviewer RLS policies.
create or replace function public.list_active_verification_badges(target_subject_type text, target_subject_id uuid)
returns table(id uuid,subject_type text,subject_id uuid,badge_kind text,label text,scope_note text,granted_at timestamptz,revoked_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select badge.id,badge.subject_type,badge.subject_id,badge.badge_kind,badge.label,badge.scope_note,badge.granted_at,badge.revoked_at
  from public.verification_badges badge
  where badge.subject_type = target_subject_type
    and badge.subject_id = target_subject_id
    and badge.revoked_at is null
    and (
      (
        target_subject_type = 'user'
        and exists(
          select 1 from public.get_profile_privacy_projection_v3(target_subject_id) projection
          where projection.can_view_profile
        )
      )
      or (
        target_subject_type = 'community'
        and exists(
          select 1 from public.communities community
          where community.id = target_subject_id
            and ((community.visibility = 'public' and community.public_read_enabled) or public.is_community_member(community.id))
        )
      )
      or (
        target_subject_type = 'role'
        and exists(
          select 1 from public.roles role
          join public.communities community on community.id = role.community_id
          where role.id = target_subject_id
            and ((community.visibility = 'public' and community.public_read_enabled) or public.is_community_member(community.id))
        )
      )
    )
  order by badge.granted_at;
$$;

revoke all on function public.get_profile_privacy_projection_v3(uuid), public.list_active_verification_badges(text,uuid) from public, anon;
grant execute on function public.get_profile_privacy_projection_v3(uuid), public.list_active_verification_badges(text,uuid) to authenticated;

comment on function public.get_profile_privacy_projection_v3(uuid) is
  'Canonical profile visibility decision for owner, blocked, shared-community, friend and visitor viewers. Activity/media require a trusted relationship and still recheck each source resource.';
comment on function public.list_active_verification_badges(text,uuid) is
  'Returns active public markers only when the current viewer may see the user/community/role subject. Verification request metadata is never exposed here.';

commit;
