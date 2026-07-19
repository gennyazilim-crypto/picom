-- Friends should always be able to load each other's profile avatar media,
-- even when profile visibility is limited to shared communities.
-- Friend list / DM rails rely on get_profile_media_v1 + storage signed URLs,
-- while profiles.avatar_url is cleared after the centralized media rebuild.

create or replace function public.can_view_profile_media_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  owner_id uuid := public.profile_media_owner_id(object_name);
  allowed boolean := false;
begin
  if auth.uid() is null or owner_id is null then return false; end if;
  if auth.uid() = owner_id then return true; end if;
  if public.users_are_blocked(auth.uid(), owner_id) then return false; end if;
  if public.are_friends(auth.uid(), owner_id) then return true; end if;
  select projection.can_view_profile into allowed
  from public.get_profile_privacy_projection_v3(owner_id) projection
  limit 1;
  return coalesce(allowed, false);
end;
$$;

create or replace function public.get_profile_media_v1(target_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  profile_row public.profiles%rowtype;
  details_row public.profile_details%rowtype;
  projection record;
  can_view boolean := false;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if public.users_are_blocked(auth.uid(), target_user_id) then
    return jsonb_build_object('user_id', target_user_id, 'can_view', false);
  end if;
  select * into projection from public.get_profile_privacy_projection_v3(target_user_id);
  can_view := projection.can_view_profile is true
    or auth.uid() = target_user_id
    or public.are_friends(auth.uid(), target_user_id);
  if not can_view then
    return jsonb_build_object('user_id', target_user_id, 'can_view', false);
  end if;
  select * into profile_row from public.profiles where id = target_user_id;
  if profile_row.id is null then raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002'; end if;
  select * into details_row from public.profile_details where user_id = target_user_id;
  return jsonb_build_object(
    'user_id', profile_row.id,
    'can_view', true,
    'display_name', profile_row.display_name,
    'avatar', jsonb_build_object(
      'path', profile_row.avatar_path,
      'thumbnail_path', profile_row.avatar_thumbnail_path,
      'version', profile_row.avatar_version,
      'content_hash', profile_row.avatar_content_hash,
      'updated_at', profile_row.avatar_updated_at,
      'legacy_url', case when profile_row.avatar_path is null then profile_row.avatar_url else null end
    ),
    'cover', jsonb_build_object(
      'path', profile_row.cover_path,
      'thumbnail_path', profile_row.cover_thumbnail_path,
      'version', profile_row.cover_version,
      'content_hash', profile_row.cover_content_hash,
      'updated_at', profile_row.cover_updated_at,
      'legacy_url', case when profile_row.cover_path is null then details_row.cover_url else null end
    ),
    'updated_at', profile_row.profile_media_updated_at
  );
end;
$$;

revoke all on function public.can_view_profile_media_object(text) from public;
revoke all on function public.get_profile_media_v1(uuid) from public;
grant execute on function public.can_view_profile_media_object(text) to authenticated;
grant execute on function public.get_profile_media_v1(uuid) to authenticated;
