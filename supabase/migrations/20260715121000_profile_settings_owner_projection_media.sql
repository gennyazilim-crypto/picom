-- Owner profile settings must always receive editable location/timezone from
-- the privacy projection so Settings > Profile cannot wipe hidden fields after
-- hydrate/save. Cover URLs align with the avatar safe-scheme rules.

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
    allowed and (owner_view or settings.show_location),
    allowed and (owner_view or settings.show_timezone),
    allowed and settings.show_activity and trusted_access,
    allowed and settings.show_media and trusted_access,
    allowed and settings.show_communities and trusted_access,
    allowed and settings.show_friends and trusted_access,
    allowed and settings.show_follows and trusted_access,
    allowed and settings.show_audio,
    case when owner_view or (allowed and settings.show_location) then settings.location end,
    case when owner_view or (allowed and settings.show_timezone) then settings.timezone end;
end;
$$;

alter table public.profile_details drop constraint if exists profile_details_cover_url_check;
alter table public.profile_details drop constraint if exists profiles_cover_url_safe;
alter table public.profile_details add constraint profiles_cover_url_safe check (
  cover_url is null or (char_length(cover_url) <= 2048 and cover_url !~* '^(javascript|data):')
);

comment on function public.get_profile_privacy_projection_v3(uuid) is
  'Privacy projection for profile domain. Owners always receive their own location and timezone for Settings editing even when those fields are hidden from other viewers.';

-- Always project the authoritative profiles.avatar_url after details merge so
-- Settings media uploads are not dropped when activity payload is stale/partial.
create or replace function public.get_profile_domain_v1(target_user_id uuid, result_limit integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  projection record;
  payload jsonb;
  details public.profile_details%rowtype;
  profile_row public.profiles%rowtype;
  profile_json jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into projection from public.get_profile_privacy_projection_v3(target_user_id);
  payload := public.get_profile_activity_v3(target_user_id, result_limit);
  payload := payload || jsonb_build_object(
    'privacy', jsonb_build_object(
      'visibility', projection.profile_visibility,
      'can_view_profile', projection.can_view_profile,
      'show_online_status', projection.show_online_status,
      'show_location', projection.show_location,
      'show_timezone', projection.show_timezone,
      'show_activity', projection.show_activity,
      'show_media', projection.show_media,
      'show_communities', projection.show_communities,
      'show_friends', projection.show_friends,
      'show_follows', projection.show_follows,
      'show_audio', projection.show_audio
    )
  );
  if projection.can_view_profile is not true then return payload; end if;
  select * into profile_row from public.profiles where id = target_user_id;
  select * into details from public.profile_details where user_id = target_user_id;
  profile_json := coalesce(payload->'profile', '{}'::jsonb) || jsonb_build_object(
    'avatar_url', profile_row.avatar_url,
    'cover_url', details.cover_url,
    'preferred_language', details.preferred_language,
    'tags', coalesce(to_jsonb(details.tags), '[]'::jsonb),
    'accent_color', profile_row.accent_color,
    'updated_at', profile_row.updated_at,
    'onboarding_completed', case when target_user_id = auth.uid() then profile_row.onboarding_completed else null end
  );
  payload := jsonb_set(payload, '{profile}', profile_json, true);
  if not projection.show_communities then
    payload := jsonb_set(payload, '{roles}', '[]'::jsonb, true);
    payload := jsonb_set(payload, '{stats,communities}', '0'::jsonb, true);
    payload := jsonb_set(payload, '{stats,roles}', '0'::jsonb, true);
  end if;
  if not projection.show_follows then
    payload := jsonb_set(payload, '{stats,followers}', '0'::jsonb, true);
    payload := jsonb_set(payload, '{stats,following}', '0'::jsonb, true);
  end if;
  return payload;
end;
$$;
