-- Profile privacy v2 adds online-status projection without changing the legacy
-- RPC signatures used by earlier clients.

alter table public.profile_privacy_settings
  add column if not exists show_online_status boolean not null default true;
create or replace function public.get_own_profile_privacy_v2()
returns table(
  profile_visibility text,
  show_online_status boolean,
  show_location boolean,
  show_timezone boolean,
  show_activity boolean,
  show_media boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  insert into public.profile_privacy_settings(user_id) values(auth.uid()) on conflict do nothing;
  return query
  select settings.profile_visibility, settings.show_online_status, settings.show_location,
    settings.show_timezone, settings.show_activity, settings.show_media
  from public.profile_privacy_settings settings where settings.user_id = auth.uid();
end;
$$;
create or replace function public.update_profile_privacy_v2(
  next_visibility text,
  next_show_online_status boolean,
  next_show_location boolean,
  next_show_timezone boolean,
  next_show_activity boolean,
  next_show_media boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or next_visibility not in ('everyone','shared_communities','friends') then
    raise exception 'PROFILE_PRIVACY_INVALID' using errcode = '22023';
  end if;
  insert into public.profile_privacy_settings(
    user_id, profile_visibility, show_online_status, show_location, show_timezone,
    show_activity, show_media, updated_at
  ) values (
    auth.uid(), next_visibility, next_show_online_status, next_show_location, next_show_timezone,
    next_show_activity, next_show_media, now()
  ) on conflict(user_id) do update set
    profile_visibility = excluded.profile_visibility,
    show_online_status = excluded.show_online_status,
    show_location = excluded.show_location,
    show_timezone = excluded.show_timezone,
    show_activity = excluded.show_activity,
    show_media = excluded.show_media,
    updated_at = now();
  return true;
end;
$$;
create or replace function public.get_profile_privacy_projection_v2(target_user_id uuid)
returns table(
  can_view_profile boolean,
  show_online_status boolean,
  show_location boolean,
  show_timezone boolean,
  show_activity boolean,
  show_media boolean,
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
  shared_access boolean;
  friend_access boolean;
  allowed boolean;
  owner_view boolean := auth.uid() = target_user_id;
begin
  if auth.uid() is null then
    return query select false,false,false,false,false,false,null::text,null::text;
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
  end if;
  shared_access := exists(
    select 1 from public.community_members viewer
    join public.community_members target on target.community_id = viewer.community_id
    where viewer.user_id = auth.uid() and target.user_id = target_user_id
  );
  friend_access := public.are_friends(auth.uid(), target_user_id);
  allowed := owner_view or (
    not public.users_are_blocked(auth.uid(), target_user_id)
    and (
      settings.profile_visibility = 'everyone'
      or (settings.profile_visibility = 'shared_communities' and shared_access)
      or (settings.profile_visibility = 'friends' and friend_access)
    )
  );
  return query select
    allowed,
    allowed and (owner_view or settings.show_online_status),
    allowed and settings.show_location,
    allowed and settings.show_timezone,
    allowed and settings.show_activity and (owner_view or shared_access or friend_access),
    allowed and settings.show_media and (owner_view or shared_access or friend_access),
    case when allowed and settings.show_location then settings.location end,
    case when allowed and settings.show_timezone then settings.timezone end;
end;
$$;
create or replace function public.get_profile_activity_v3(target_user_id uuid, result_limit integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  projection record;
  payload jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into projection from public.get_profile_privacy_projection_v2(target_user_id);
  payload := public.get_profile_activity_v2(target_user_id, result_limit);
  if projection.can_view_profile and not projection.show_online_status and target_user_id <> auth.uid() then
    payload := jsonb_set(payload, '{profile,status}', '"offline"'::jsonb, true);
    payload := jsonb_set(payload, '{profile,status_text}', 'null'::jsonb, true);
  end if;
  return payload;
end;
$$;
revoke all on function public.get_own_profile_privacy_v2(),
  public.update_profile_privacy_v2(text,boolean,boolean,boolean,boolean,boolean),
  public.get_profile_privacy_projection_v2(uuid),
  public.get_profile_activity_v3(uuid,integer)
from public, anon;
grant execute on function public.get_own_profile_privacy_v2(),
  public.update_profile_privacy_v2(text,boolean,boolean,boolean,boolean,boolean),
  public.get_profile_privacy_projection_v2(uuid),
  public.get_profile_activity_v3(uuid,integer)
to authenticated;
-- v3 is the client-facing profile activity boundary; v2 remains callable only
-- by trusted database functions/owners for compatibility.
revoke execute on function public.get_profile_activity_v2(uuid,integer) from authenticated;
comment on function public.get_profile_activity_v3(uuid,integer) is
  'Profile activity v2 payload with online status removed server-side when the target privacy setting hides it.';
