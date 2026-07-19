-- Centralized private, versioned profile avatar and cover media contract.
begin;

alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists avatar_thumbnail_path text;
alter table public.profiles add column if not exists avatar_version bigint not null default 0;
alter table public.profiles add column if not exists avatar_content_hash text;
alter table public.profiles add column if not exists avatar_updated_at timestamptz;
alter table public.profiles add column if not exists cover_path text;
alter table public.profiles add column if not exists cover_thumbnail_path text;
alter table public.profiles add column if not exists cover_version bigint not null default 0;
alter table public.profiles add column if not exists cover_content_hash text;
alter table public.profiles add column if not exists cover_updated_at timestamptz;
alter table public.profiles add column if not exists profile_media_updated_at timestamptz;

-- Preserve legacy profile-media objects while future writes use immutable paths.
update public.profiles
set avatar_path = regexp_replace(split_part(avatar_url, '?', 1), '^.*/profile-media/', ''),
    avatar_version = greatest(avatar_version, 1),
    avatar_updated_at = coalesce(avatar_updated_at, updated_at, now()),
    profile_media_updated_at = coalesce(profile_media_updated_at, updated_at, now())
where avatar_path is null
  and avatar_url ~* '/storage/v1/object/(public|sign|authenticated)/profile-media/';

update public.profiles profile
set cover_path = regexp_replace(split_part(details.cover_url, '?', 1), '^.*/profile-media/', ''),
    cover_version = greatest(profile.cover_version, 1),
    cover_updated_at = coalesce(profile.cover_updated_at, profile.updated_at, now()),
    profile_media_updated_at = coalesce(profile.profile_media_updated_at, profile.updated_at, now())
from public.profile_details details
where details.user_id = profile.id
  and profile.cover_path is null
  and details.cover_url ~* '/storage/v1/object/(public|sign|authenticated)/profile-media/';

alter table public.profiles drop constraint if exists profiles_avatar_path_contract;
alter table public.profiles add constraint profiles_avatar_path_contract check (
  avatar_path is null or avatar_path ~* '^(avatars/[0-9a-f-]{36}/avatar-[0-9]+\.webp|[0-9a-f-]{36}/avatar/[A-Za-z0-9._/-]+)$'
);
alter table public.profiles drop constraint if exists profiles_cover_path_contract;
alter table public.profiles add constraint profiles_cover_path_contract check (
  cover_path is null or cover_path ~* '^(covers/[0-9a-f-]{36}/cover-[0-9]+\.webp|[0-9a-f-]{36}/cover/[A-Za-z0-9._/-]+)$'
);
alter table public.profiles drop constraint if exists profiles_avatar_thumbnail_path_contract;
alter table public.profiles add constraint profiles_avatar_thumbnail_path_contract check (
  avatar_thumbnail_path is null or avatar_thumbnail_path ~* '^thumbnails/avatars/[0-9a-f-]{36}/avatar-[0-9]+\.webp$'
);
alter table public.profiles drop constraint if exists profiles_cover_thumbnail_path_contract;
alter table public.profiles add constraint profiles_cover_thumbnail_path_contract check (
  cover_thumbnail_path is null or cover_thumbnail_path ~* '^thumbnails/covers/[0-9a-f-]{36}/cover-[0-9]+\.webp$'
);

create or replace function public.profile_media_owner_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  parts text[] := string_to_array(object_name, '/');
  candidate text;
begin
  candidate := case
    when parts[1] = 'thumbnails' then parts[3]
    when parts[1] in ('avatars', 'covers') then parts[2]
    else parts[1]
  end;
  return candidate::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create or replace function public.is_canonical_profile_media_path(object_name text, owner_id uuid)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select object_name ~* (
    '^(avatars/' || owner_id::text || '/avatar-[0-9]+\.webp'
    || '|covers/' || owner_id::text || '/cover-[0-9]+\.webp'
    || '|thumbnails/avatars/' || owner_id::text || '/avatar-[0-9]+\.webp'
    || '|thumbnails/covers/' || owner_id::text || '/cover-[0-9]+\.webp)$'
  );
$$;

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
  select projection.can_view_profile into allowed
  from public.get_profile_privacy_projection_v3(owner_id) projection
  limit 1;
  return coalesce(allowed, false);
end;
$$;

revoke all on function public.profile_media_owner_id(text) from public;
revoke all on function public.is_canonical_profile_media_path(text, uuid) from public;
revoke all on function public.can_view_profile_media_object(text) from public;
grant execute on function public.profile_media_owner_id(text) to authenticated;
grant execute on function public.is_canonical_profile_media_path(text, uuid) to authenticated;
grant execute on function public.can_view_profile_media_object(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', false, 4194304, array['image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
declare policy_row record;
begin
  for policy_row in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (policyname ilike 'profile_media%' or policyname ilike 'profile-media%')
  loop
    execute format('drop policy if exists %I on storage.objects', policy_row.policyname);
  end loop;
end;
$$;

create policy profile_media_private_read
on storage.objects for select to authenticated
using (bucket_id = 'profile-media' and public.can_view_profile_media_object(name));

create policy profile_media_canonical_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-media'
  and public.profile_media_owner_id(name) = auth.uid()
  and public.is_canonical_profile_media_path(name, auth.uid())
);

create policy profile_media_owner_delete
on storage.objects for delete to authenticated
using (bucket_id = 'profile-media' and public.profile_media_owner_id(name) = auth.uid());

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
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into projection from public.get_profile_privacy_projection_v3(target_user_id);
  if projection.can_view_profile is not true then
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

create or replace function public.commit_profile_media_v1(
  target_kind text,
  target_path text,
  target_thumbnail_path text,
  target_content_hash text,
  expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_row public.profiles%rowtype;
  next_version bigint;
  old_path text;
  old_thumbnail_path text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if target_kind not in ('avatar', 'cover') then raise exception 'INVALID_MEDIA_KIND' using errcode = '22023'; end if;
  if target_content_hash is null or target_content_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_CONTENT_HASH' using errcode = '22023'; end if;
  select * into profile_row from public.profiles where id = auth.uid() for update;
  if profile_row.id is null then raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002'; end if;
  if expected_version <> (case when target_kind = 'avatar' then profile_row.avatar_version else profile_row.cover_version end) then
    raise exception 'PROFILE_MEDIA_VERSION_CONFLICT' using errcode = '40001';
  end if;
  next_version := expected_version + 1;
  if target_path <> (target_kind || 's/' || auth.uid()::text || '/' || target_kind || '-' || next_version::text || '.webp') then
    raise exception 'INVALID_MEDIA_PATH' using errcode = '22023';
  end if;
  if target_thumbnail_path <> ('thumbnails/' || target_kind || 's/' || auth.uid()::text || '/' || target_kind || '-' || next_version::text || '.webp') then
    raise exception 'INVALID_THUMBNAIL_PATH' using errcode = '22023';
  end if;
  if target_kind = 'avatar' then
    old_path := profile_row.avatar_path;
    old_thumbnail_path := profile_row.avatar_thumbnail_path;
    update public.profiles set
      avatar_path = target_path,
      avatar_thumbnail_path = target_thumbnail_path,
      avatar_version = next_version,
      avatar_content_hash = target_content_hash,
      avatar_updated_at = now(),
      profile_media_updated_at = now(),
      avatar_url = null,
      updated_at = now()
    where id = auth.uid();
  else
    old_path := profile_row.cover_path;
    old_thumbnail_path := profile_row.cover_thumbnail_path;
    update public.profiles set
      cover_path = target_path,
      cover_thumbnail_path = target_thumbnail_path,
      cover_version = next_version,
      cover_content_hash = target_content_hash,
      cover_updated_at = now(),
      profile_media_updated_at = now(),
      updated_at = now()
    where id = auth.uid();
    update public.profile_details set cover_url = null, updated_at = now() where user_id = auth.uid();
  end if;
  return jsonb_build_object(
    'user_id', auth.uid(), 'kind', target_kind, 'path', target_path,
    'thumbnail_path', target_thumbnail_path, 'version', next_version,
    'content_hash', target_content_hash, 'updated_at', now(),
    'old_path', old_path, 'old_thumbnail_path', old_thumbnail_path
  );
end;
$$;

create or replace function public.remove_profile_media_v1(target_kind text, expected_version bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_row public.profiles%rowtype;
  next_version bigint;
  old_path text;
  old_thumbnail_path text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if target_kind not in ('avatar', 'cover') then raise exception 'INVALID_MEDIA_KIND' using errcode = '22023'; end if;
  select * into profile_row from public.profiles where id = auth.uid() for update;
  if profile_row.id is null then raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002'; end if;
  if expected_version <> (case when target_kind = 'avatar' then profile_row.avatar_version else profile_row.cover_version end) then
    raise exception 'PROFILE_MEDIA_VERSION_CONFLICT' using errcode = '40001';
  end if;
  next_version := expected_version + 1;
  if target_kind = 'avatar' then
    old_path := profile_row.avatar_path;
    old_thumbnail_path := profile_row.avatar_thumbnail_path;
    update public.profiles set
      avatar_path = null, avatar_thumbnail_path = null, avatar_version = next_version,
      avatar_content_hash = null, avatar_updated_at = now(), profile_media_updated_at = now(),
      avatar_url = null, updated_at = now()
    where id = auth.uid();
  else
    old_path := profile_row.cover_path;
    old_thumbnail_path := profile_row.cover_thumbnail_path;
    update public.profiles set
      cover_path = null, cover_thumbnail_path = null, cover_version = next_version,
      cover_content_hash = null, cover_updated_at = now(), profile_media_updated_at = now(),
      updated_at = now()
    where id = auth.uid();
    update public.profile_details set cover_url = null, updated_at = now() where user_id = auth.uid();
  end if;
  return jsonb_build_object(
    'user_id', auth.uid(), 'kind', target_kind, 'version', next_version,
    'updated_at', now(), 'old_path', old_path, 'old_thumbnail_path', old_thumbnail_path
  );
end;
$$;

revoke all on function public.get_profile_media_v1(uuid) from public;
revoke all on function public.commit_profile_media_v1(text, text, text, text, bigint) from public;
revoke all on function public.remove_profile_media_v1(text, bigint) from public;
grant execute on function public.get_profile_media_v1(uuid) to authenticated;
grant execute on function public.commit_profile_media_v1(text, text, text, text, bigint) to authenticated;
grant execute on function public.remove_profile_media_v1(text, bigint) to authenticated;

create index if not exists profiles_profile_media_updated_idx
on public.profiles(profile_media_updated_at desc)
where profile_media_updated_at is not null;

commit;
