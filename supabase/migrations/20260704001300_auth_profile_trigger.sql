-- Connect Supabase Auth registration to public profiles.
-- New email/password users get a safe public profile row automatically.

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_username text;
  safe_username text;
  profile_display_name text;
begin
  raw_username := regexp_replace(lower(coalesce(split_part(new.email, '@', 1), 'user')), '[^a-z0-9._-]+', '-', 'g');
  raw_username := trim(both '-.' from raw_username);

  if char_length(raw_username) < 3 then
    raw_username := 'user';
  end if;

  safe_username := left(raw_username, 24) || '-' || left(replace(new.id::text, '-', ''), 6);
  profile_display_name := nullif(new.raw_user_meta_data ->> 'display_name', '');

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
  ) values (
    new.id,
    safe_username,
    coalesce(profile_display_name, nullif(raw_username, ''), 'Picom User'),
    null,
    'offline',
    'New to Picom',
    null,
    '#007571',
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.handle_new_auth_user_profile();