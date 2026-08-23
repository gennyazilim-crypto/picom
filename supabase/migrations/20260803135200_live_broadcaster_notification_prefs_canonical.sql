-- Compatibility predecessor for Live Now broadcaster notification modes.
-- SOURCE_MIGRATION: NOT_FOUND_IN_GIT_HISTORY
-- CANONICAL_SOURCE: STAGING_SCHEMA_INTROSPECTION (picom-staging / ufmtvqtsklqsmqxefbbs)
-- Required before 20260803172000 ALTER/function bodies.

begin;

do $picom_lbn_guard$
declare
  rel regclass := to_regclass('public.live_broadcaster_notification_prefs');
  missing text;
begin
  if rel is null then
    return;
  end if;

  select string_agg(required.column_name, ', ' order by required.column_name)
    into missing
  from (
    values
      ('viewer_user_id', 'uuid'),
      ('broadcaster_user_id', 'uuid'),
      ('mode', 'text'),
      ('updated_at', 'timestamp with time zone')
  ) as required(column_name, data_type)
  left join information_schema.columns col
    on col.table_schema = 'public'
   and col.table_name = 'live_broadcaster_notification_prefs'
   and col.column_name = required.column_name
   and col.data_type = required.data_type
  where col.column_name is null;

  if missing is not null then
    raise exception 'LIVE_BROADCASTER_NOTIFICATION_PREFS_INCOMPATIBLE_SCHEMA'
      using errcode = '55000',
            hint = format('Existing public.live_broadcaster_notification_prefs is missing/mismatched columns: %s', missing);
  end if;
end;
$picom_lbn_guard$;

create table if not exists public.live_broadcaster_notification_prefs (
  viewer_user_id uuid not null references public.profiles(id) on delete cascade,
  broadcaster_user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null default 'all_live'
    check (mode = any (array[
      'all_live'::text,
      'scheduled_only'::text,
      'important_only'::text,
      'off'::text
    ])),
  updated_at timestamptz not null default now(),
  primary key (viewer_user_id, broadcaster_user_id),
  check (viewer_user_id <> broadcaster_user_id)
);

alter table public.live_broadcaster_notification_prefs enable row level security;

drop policy if exists live_broadcaster_notif_select on public.live_broadcaster_notification_prefs;
create policy live_broadcaster_notif_select
  on public.live_broadcaster_notification_prefs
  for select
  to authenticated
  using (viewer_user_id = auth.uid());

drop policy if exists live_broadcaster_notif_insert on public.live_broadcaster_notification_prefs;
create policy live_broadcaster_notif_insert
  on public.live_broadcaster_notification_prefs
  for insert
  to authenticated
  with check (
    (viewer_user_id = auth.uid())
    and (broadcaster_user_id <> auth.uid())
    and (not public.users_are_blocked(auth.uid(), broadcaster_user_id))
  );

drop policy if exists live_broadcaster_notif_update on public.live_broadcaster_notification_prefs;
create policy live_broadcaster_notif_update
  on public.live_broadcaster_notification_prefs
  for update
  to authenticated
  using (viewer_user_id = auth.uid())
  with check (
    (viewer_user_id = auth.uid())
    and (broadcaster_user_id <> auth.uid())
  );

drop policy if exists live_broadcaster_notif_delete on public.live_broadcaster_notification_prefs;
create policy live_broadcaster_notif_delete
  on public.live_broadcaster_notification_prefs
  for delete
  to authenticated
  using (viewer_user_id = auth.uid());

revoke all on table public.live_broadcaster_notification_prefs from public, anon;
grant select, insert, update, delete, references, trigger, truncate
  on table public.live_broadcaster_notification_prefs to authenticated;
grant select, insert, update, delete, references, trigger, truncate
  on table public.live_broadcaster_notification_prefs to service_role;

commit;
