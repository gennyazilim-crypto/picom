-- Secure caller-avatar projection for incoming DM call notifications.
-- The renderer receives only profile media metadata for an active call it participates in.
begin;

alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists avatar_updated_at timestamptz;

create or replace function public.profile_media_path_from_url(source_url text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when nullif(btrim(source_url), '') is null then null
    when split_part(source_url, '?', 1) ~* '/storage/v1/object/(public|sign|authenticated)/profile-media/'
      then regexp_replace(
        split_part(source_url, '?', 1),
        '^.*?/storage/v1/object/(public|sign|authenticated)/profile-media/',
        '',
        'i'
      )
    when split_part(source_url, '?', 1) ~ '^[0-9a-fA-F-]{36}/(avatar|cover)/[A-Za-z0-9._/-]+$'
      then split_part(source_url, '?', 1)
    else null
  end
$$;

create or replace function public.sync_profile_avatar_media_metadata()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' or new.avatar_url is distinct from old.avatar_url then
    new.avatar_path := public.profile_media_path_from_url(new.avatar_url);
    new.avatar_updated_at := case when new.avatar_url is null then null else now() end;
  elsif new.avatar_path is null and new.avatar_url is not null then
    new.avatar_path := public.profile_media_path_from_url(new.avatar_url);
  end if;
  return new;
end
$$;

drop trigger if exists profiles_sync_avatar_media_metadata on public.profiles;
create trigger profiles_sync_avatar_media_metadata
before insert or update of avatar_url on public.profiles
for each row execute function public.sync_profile_avatar_media_metadata();

update public.profiles
set avatar_path = public.profile_media_path_from_url(avatar_url),
    avatar_updated_at = coalesce(avatar_updated_at, updated_at, now())
where avatar_url is not null
  and (avatar_path is null or avatar_updated_at is null);

create or replace function public.resolve_incoming_call_caller_profile(target_call_id uuid)
returns table(
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  avatar_path text,
  avatar_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  return query
  select
    profile.id,
    profile.display_name,
    profile.username,
    profile.avatar_url,
    coalesce(profile.avatar_path, public.profile_media_path_from_url(profile.avatar_url)),
    coalesce(profile.avatar_updated_at, profile.updated_at)
  from public.dm_calls call
  join public.profiles profile on profile.id = call.created_by
  join public.dm_call_participants recipient
    on recipient.call_id = call.id
   and recipient.user_id = auth.uid()
  where call.id = target_call_id
    and call.created_by <> auth.uid()
    and call.status in ('ringing', 'active')
    and public.is_direct_conversation_participant(call.conversation_id)
  limit 1;
end
$$;

revoke all on function public.resolve_incoming_call_caller_profile(uuid) from public, anon;
grant execute on function public.resolve_incoming_call_caller_profile(uuid) to authenticated;

drop policy if exists profile_media_authenticated_avatar_read on storage.objects;
create policy profile_media_authenticated_avatar_read
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-media'
  and name ~ '^[0-9a-fA-F-]{36}/avatar/[A-Za-z0-9._/-]+$'
);

comment on function public.resolve_incoming_call_caller_profile(uuid) is
  'Returns current caller identity and profile-media metadata only to an authenticated participant in the active DM call.';

commit;
