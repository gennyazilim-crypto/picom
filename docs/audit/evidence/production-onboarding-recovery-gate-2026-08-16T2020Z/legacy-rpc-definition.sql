-- SOURCE: actual hosted production pg_get_functiondef
-- project: picom-production / cqnsetsmcduraryemhbi
-- captured_at: 2026-08-16T2020Z
-- oid: 21328
-- This file is a sanitized definition snapshot. It contains no secrets or PII.
-- NOT EXECUTED by TASK 13C.1A.

CREATE OR REPLACE FUNCTION public.complete_current_user_onboarding(target_profile jsonb, target_followed_user_ids uuid[] DEFAULT '{}'::uuid[], target_theme text DEFAULT 'system'::text)
 RETURNS TABLE(completed boolean, completed_at timestamp with time zone, followed_user_ids uuid[], theme_mode text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor_id uuid := auth.uid();
  completed_timestamp timestamptz := now();
  normalized_display_name text;
  normalized_username text;
  normalized_status_text text;
  normalized_theme text := lower(coalesce(target_theme, 'system'));
  candidate_user_id uuid;
  persisted_followed_user_ids uuid[] := '{}'::uuid[];
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if target_profile is null or jsonb_typeof(target_profile) <> 'object' then
    raise exception 'ONBOARDING_PROFILE_INVALID' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(target_profile) as profile_key
    where profile_key not in ('displayName', 'username', 'statusText')
  ) then
    raise exception 'ONBOARDING_PROFILE_FIELD_INVALID' using errcode = '22023';
  end if;

  normalized_display_name := nullif(btrim(target_profile ->> 'displayName'), '');
  normalized_username := nullif(btrim(target_profile ->> 'username'), '');
  normalized_status_text := coalesce(btrim(target_profile ->> 'statusText'), '');

  if normalized_display_name is null or char_length(normalized_display_name) > 80 then
    raise exception 'ONBOARDING_DISPLAY_NAME_INVALID' using errcode = '22023';
  end if;
  if normalized_username is not null and (
    char_length(normalized_username) < 3
    or char_length(normalized_username) > 32
    or normalized_username !~ '^[A-Za-z0-9_.-]+$'
  ) then
    raise exception 'ONBOARDING_USERNAME_INVALID' using errcode = '22023';
  end if;
  if char_length(normalized_status_text) > 120 then
    raise exception 'ONBOARDING_STATUS_INVALID' using errcode = '22023';
  end if;
  if normalized_theme not in ('light', 'dark', 'system') then
    raise exception 'ONBOARDING_THEME_INVALID' using errcode = '22023';
  end if;
  if cardinality(coalesce(target_followed_user_ids, '{}'::uuid[])) > 10 then
    raise exception 'ONBOARDING_FOLLOW_LIMIT_EXCEEDED' using errcode = '22023';
  end if;
  if array_position(coalesce(target_followed_user_ids, '{}'::uuid[]), null) is not null then
    raise exception 'ONBOARDING_FOLLOW_TARGET_INVALID' using errcode = '22023';
  end if;

  update public.profiles as profile
  set display_name = normalized_display_name,
      username = coalesce(normalized_username, profile.username),
      status_text = normalized_status_text,
      onboarding_completed = true,
      onboarding_completed_at = completed_timestamp,
      updated_at = completed_timestamp
  where profile.id = actor_id;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  for candidate_user_id in
    select distinct selected_user_id
    from unnest(coalesce(target_followed_user_ids, '{}'::uuid[])) as selected_user_id
  loop
    perform public.follow_user(candidate_user_id);
  end loop;

  insert into public.user_settings(user_id, schema_version, theme_mode, updated_at)
  values (actor_id, 1, normalized_theme, completed_timestamp)
  on conflict (user_id) do update
  set theme_mode = excluded.theme_mode,
      updated_at = excluded.updated_at;

  select coalesce(array_agg(follow.followed_id order by follow.followed_id), '{}'::uuid[])
  into persisted_followed_user_ids
  from public.user_follows as follow
  where follow.follower_id = actor_id;

  return query
  select true, completed_timestamp, persisted_followed_user_ids, normalized_theme;
end;
$function$;
