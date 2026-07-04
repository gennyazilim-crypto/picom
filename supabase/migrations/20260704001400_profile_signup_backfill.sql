-- Backfill public profiles for existing Supabase Auth users.
-- Complements the after-signup trigger by covering users created before the trigger existed.

with normalized_auth_users as (
  select
    auth_user.id,
    auth_user.email,
    auth_user.raw_user_meta_data,
    trim(both '-.' from regexp_replace(lower(coalesce(split_part(auth_user.email, '@', 1), 'user')), '[^a-z0-9._-]+', '-', 'g')) as raw_username
  from auth.users auth_user
), profile_rows as (
  select
    id,
    left(case when char_length(raw_username) < 3 then 'user' else raw_username end, 24)
      || '-' || left(replace(id::text, '-', ''), 6) as username,
    coalesce(
      nullif(raw_user_meta_data ->> 'display_name', ''),
      nullif(case when char_length(raw_username) < 3 then 'user' else raw_username end, ''),
      'Picom User'
    ) as display_name
  from normalized_auth_users
)
insert into public.profiles (
  id,
  username,
  display_name,
  avatar_url,
  status,
  status_text,
  bio,
  accent_color,
  created_at,
  updated_at
)
select
  profile_rows.id,
  profile_rows.username,
  profile_rows.display_name,
  null,
  'offline',
  'New to Picom',
  null,
  '#007571',
  now(),
  now()
from profile_rows
where not exists (
  select 1
  from public.profiles existing_profile
  where existing_profile.id = profile_rows.id
)
on conflict (id) do nothing;