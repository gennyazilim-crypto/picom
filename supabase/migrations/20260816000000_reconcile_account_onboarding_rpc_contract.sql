-- Reconciles the account-onboarding RPC with the desktop client contract.
-- The historical three-argument function remains immutable; this forward-only
-- migration replaces its callable signature without touching profile data.

alter table public.profiles
  add column if not exists onboarding_start_choice text;

alter table public.profiles
  add column if not exists onboarding_initial_feed text;

alter table public.profiles
  drop constraint if exists profiles_onboarding_start_choice_check;

alter table public.profiles
  add constraint profiles_onboarding_start_choice_check
  check (onboarding_start_choice is null or onboarding_start_choice in ('createCommunity', 'joinInvite', 'mentionFeed')) not valid;

alter table public.profiles
  drop constraint if exists profiles_onboarding_initial_feed_check;

alter table public.profiles
  add constraint profiles_onboarding_initial_feed_check
  check (onboarding_initial_feed is null or onboarding_initial_feed in ('mention', 'community', 'invite')) not valid;

-- PostgreSQL cannot CREATE OR REPLACE a function while changing its input
-- signature. Remove only the superseded three-argument overload so PostgREST
-- exposes one canonical RPC name and argument list.
drop function if exists public.complete_current_user_onboarding(jsonb, uuid[], text);
drop function if exists public.complete_current_user_onboarding(jsonb, uuid[], text, text);
drop function if exists public.complete_current_user_onboarding(jsonb, uuid[], text, text, text);

create function public.complete_current_user_onboarding(
  target_profile jsonb,
  target_followed_user_ids uuid[] default '{}'::uuid[],
  target_theme text default 'system',
  target_start_choice text default 'mentionFeed',
  target_invite_code text default null
)
returns table(
  completed boolean,
  completed_at timestamptz,
  followed_user_ids uuid[],
  theme_mode text,
  initial_feed text,
  start_choice text
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  actor_id uuid := auth.uid();
  completed_timestamp timestamptz := now();
  persisted_completed_at timestamptz;
  normalized_display_name text;
  normalized_username text;
  normalized_status_text text;
  normalized_theme text := lower(coalesce(target_theme, 'system'));
  normalized_start_choice text := coalesce(nullif(btrim(target_start_choice), ''), 'mentionFeed');
  normalized_invite_code text := nullif(btrim(target_invite_code), '');
  persisted_initial_feed text;
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
  if normalized_start_choice not in ('createCommunity', 'joinInvite', 'mentionFeed') then
    raise exception 'ONBOARDING_START_CHOICE_INVALID' using errcode = '22023';
  end if;
  if normalized_start_choice = 'joinInvite' and normalized_invite_code is null then
    raise exception 'ONBOARDING_INVITE_CODE_REQUIRED' using errcode = '22023';
  end if;
  if normalized_invite_code is not null and char_length(normalized_invite_code) > 128 then
    raise exception 'ONBOARDING_INVITE_CODE_INVALID' using errcode = '22023';
  end if;
  if cardinality(coalesce(target_followed_user_ids, '{}'::uuid[])) > 10 then
    raise exception 'ONBOARDING_FOLLOW_LIMIT_EXCEEDED' using errcode = '22023';
  end if;
  if array_position(coalesce(target_followed_user_ids, '{}'::uuid[]), null) is not null then
    raise exception 'ONBOARDING_FOLLOW_TARGET_INVALID' using errcode = '22023';
  end if;

  persisted_initial_feed := case normalized_start_choice
    when 'createCommunity' then 'community'
    when 'joinInvite' then 'invite'
    else 'mention'
  end;

  update public.profiles as profile
  set display_name = normalized_display_name,
      username = coalesce(normalized_username, profile.username),
      status_text = normalized_status_text,
      onboarding_completed = true,
      onboarding_completed_at = coalesce(profile.onboarding_completed_at, completed_timestamp),
      onboarding_start_choice = normalized_start_choice,
      onboarding_initial_feed = persisted_initial_feed,
      updated_at = completed_timestamp
  where profile.id = actor_id
  returning profile.onboarding_completed_at into persisted_completed_at;

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
  select true, persisted_completed_at, persisted_followed_user_ids, normalized_theme, persisted_initial_feed, normalized_start_choice;
end;
$$;

revoke all on function public.complete_current_user_onboarding(jsonb, uuid[], text, text, text) from public, anon, service_role;
grant execute on function public.complete_current_user_onboarding(jsonb, uuid[], text, text, text) to authenticated;

comment on column public.profiles.onboarding_start_choice is
  'The authenticated account onboarding destination selected by the user.';
comment on column public.profiles.onboarding_initial_feed is
  'The initial desktop destination derived from onboarding_start_choice.';
comment on function public.complete_current_user_onboarding(jsonb, uuid[], text, text, text) is
  'Atomically completes only auth.uid() onboarding, applies privacy-aware follows and theme, persists the selected start destination, and validates invite intent without accepting the invite. Invite acceptance remains a separate post-finish flow.';
