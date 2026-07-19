create table if not exists public.user_settings(
  user_id uuid primary key references public.profiles(id) on delete cascade,
  schema_version integer not null default 1 check(schema_version between 1 and 1000),
  notification_settings jsonb not null default '{}'::jsonb check(jsonb_typeof(notification_settings)='object'),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
revoke all on public.user_settings from public,anon;
grant select,insert,update on public.user_settings to authenticated;
drop policy if exists "user_settings_select_own" on public.user_settings;
drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own" on public.user_settings for select to authenticated using(user_id=auth.uid());
drop policy if exists "user_settings_insert_own" on public.user_settings;
drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own" on public.user_settings for insert to authenticated with check(user_id=auth.uid());
drop policy if exists "user_settings_update_own" on public.user_settings;
drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own" on public.user_settings for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

comment on table public.user_settings is 'Account-synced Picom preferences only. Device-local, community-specific, and server-controlled settings are intentionally excluded.';;
