-- Compatibility predecessor for account + Publisher notification prefs.
-- SOURCE_MIGRATION: NOT_FOUND_IN_GIT_HISTORY
-- CANONICAL_SOURCE: STAGING_SCHEMA_INTROSPECTION (picom-staging / ufmtvqtsklqsmqxefbbs)
-- Required before 20260803172000 and by register_account_center_profile inserts.

begin;

do $picom_np_guard$
declare
  rel regclass := to_regclass('public.notification_preferences');
  missing text;
begin
  if rel is null then
    return;
  end if;

  select string_agg(required.column_name, ', ' order by required.column_name)
    into missing
  from (
    values
      ('user_id', 'uuid'),
      ('security_email', 'boolean'),
      ('new_device_email', 'boolean'),
      ('dm_notifications', 'boolean'),
      ('community_notifications', 'boolean'),
      ('feed_notifications', 'boolean'),
      ('connection_notifications', 'boolean'),
      ('verification_notifications', 'boolean'),
      ('product_updates', 'boolean'),
      ('marketing_email', 'boolean'),
      ('desktop_notifications', 'boolean'),
      ('push_notifications', 'boolean'),
      ('updated_at', 'timestamp with time zone')
  ) as required(column_name, data_type)
  left join information_schema.columns col
    on col.table_schema = 'public'
   and col.table_name = 'notification_preferences'
   and col.column_name = required.column_name
   and col.data_type = required.data_type
  where col.column_name is null;

  if missing is not null then
    raise exception 'NOTIFICATION_PREFERENCES_INCOMPATIBLE_SCHEMA'
      using errcode = '55000',
            hint = format('Existing public.notification_preferences is missing/mismatched columns: %s', missing);
  end if;
end;
$picom_np_guard$;

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  security_email boolean not null default true,
  new_device_email boolean not null default true,
  dm_notifications boolean not null default true,
  community_notifications boolean not null default true,
  feed_notifications boolean not null default true,
  connection_notifications boolean not null default true,
  verification_notifications boolean not null default true,
  product_updates boolean not null default false,
  marketing_email boolean not null default false,
  desktop_notifications boolean not null default true,
  push_notifications boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_own_select on public.notification_preferences;
create policy notification_preferences_own_select
  on public.notification_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists notification_preferences_own_insert on public.notification_preferences;
create policy notification_preferences_own_insert
  on public.notification_preferences
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists notification_preferences_own_update on public.notification_preferences;
create policy notification_preferences_own_update
  on public.notification_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check ((user_id = auth.uid()) and (security_email = true));

revoke all on table public.notification_preferences from public, anon;
grant select, insert, update, references, trigger, truncate
  on table public.notification_preferences to authenticated;
grant select, insert, update, delete, references, trigger, truncate
  on table public.notification_preferences to service_role;

commit;
