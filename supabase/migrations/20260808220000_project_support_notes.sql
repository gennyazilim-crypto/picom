-- Project Support Notes (HAVOOC Support Hub signature wall).
-- RPC-only writes, RLS for public visible reads, one active note per user/project.

begin;

create table if not exists public.support_projects (
  id text primary key check (char_length(id) between 2 and 64 and id ~ '^[a-z][a-z0-9_-]*$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  owner_user_id uuid null references public.profiles(id) on delete set null,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.support_projects is
  'Canonical support-hub projects (e.g. havooc). Owner identity is UUID-based, never email.';

insert into public.support_projects (id, display_name, is_public)
values ('havooc', 'HAVOOC', true)
on conflict (id) do nothing;

create table if not exists public.project_support_notes (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.support_projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  moderation_status text not null default 'visible'
    check (moderation_status in ('visible', 'hidden', 'removed')),
  moderated_at timestamptz null,
  moderated_by uuid null references public.profiles(id) on delete set null,
  moderation_reason text null check (moderation_reason is null or char_length(moderation_reason) <= 500)
);

comment on table public.project_support_notes is
  'Short community support notes / signature wall. Soft-delete + moderation; no HTML/markdown.';

create unique index if not exists project_support_notes_one_active_idx
  on public.project_support_notes (project_id, user_id)
  where deleted_at is null;

create index if not exists project_support_notes_list_newest_idx
  on public.project_support_notes (project_id, created_at desc, id desc)
  where deleted_at is null and moderation_status = 'visible';

create index if not exists project_support_notes_list_oldest_idx
  on public.project_support_notes (project_id, created_at asc, id asc)
  where deleted_at is null and moderation_status = 'visible';

create table if not exists public.project_support_note_reports (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.project_support_notes(id) on delete cascade,
  project_id text not null references public.support_projects(id) on delete cascade,
  reporter_user_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('spam', 'harassment', 'hate', 'scam', 'other')),
  description text null check (description is null or char_length(description) <= 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'action_taken')),
  created_at timestamptz not null default now(),
  unique (note_id, reporter_user_id)
);

create index if not exists project_support_note_reports_project_created_idx
  on public.project_support_note_reports (project_id, created_at desc);

create table if not exists public.project_support_note_rate_limits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id text not null references public.support_projects(id) on delete cascade,
  action text not null check (char_length(action) between 1 and 40),
  window_started_at timestamptz not null,
  attempts integer not null default 1 check (attempts >= 0),
  primary key (user_id, project_id, action, window_started_at)
);

alter table public.support_projects enable row level security;
alter table public.project_support_notes enable row level security;
alter table public.project_support_note_reports enable row level security;
alter table public.project_support_note_rate_limits enable row level security;

revoke all on table public.support_projects from public, anon, authenticated;
revoke all on table public.project_support_notes from public, anon, authenticated;
revoke all on table public.project_support_note_reports from public, anon, authenticated;
revoke all on table public.project_support_note_rate_limits from public, anon, authenticated;
grant select on table public.support_projects to anon, authenticated;
grant select on table public.project_support_notes to anon, authenticated;
grant all on table public.support_projects to service_role;
grant all on table public.project_support_notes to service_role;
grant all on table public.project_support_note_reports to service_role;
grant all on table public.project_support_note_rate_limits to service_role;

drop policy if exists support_projects_public_select on public.support_projects;
create policy support_projects_public_select on public.support_projects
  for select to anon, authenticated
  using (is_public = true);

drop policy if exists project_support_notes_visible_select on public.project_support_notes;
create policy project_support_notes_visible_select on public.project_support_notes
  for select to anon, authenticated
  using (
    deleted_at is null
    and moderation_status = 'visible'
    and exists (
      select 1 from public.support_projects p
      where p.id = project_id and p.is_public = true
    )
  );

drop policy if exists project_support_notes_owner_select on public.project_support_notes;
create policy project_support_notes_owner_select on public.project_support_notes
  for select to authenticated
  using (user_id = auth.uid() and deleted_at is null);

-- Helpers
create or replace function public.support_note_normalize_body(raw_body text)
returns text
language sql
immutable
as $$
  select left(
    btrim(regexp_replace(regexp_replace(coalesce(raw_body, ''), E'[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]', '', 'g'), E'\\s+', ' ', 'g')),
    160
  );
$$;

create or replace function public.support_note_word_count(normalized_body text)
returns integer
language sql
immutable
as $$
  select case
    when coalesce(normalized_body, '') = '' then 0
    else cardinality(regexp_split_to_array(normalized_body, E'\\s+'))
  end;
$$;

create or replace function public.support_note_contains_url(normalized_body text)
returns boolean
language sql
immutable
as $$
  select public.live_chat_contains_url(normalized_body);
$$;

create or replace function public.support_note_actor_eligible()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.deactivated_at is null
    )
    and not exists (
      select 1 from public.platform_account_restrictions r
      where r.user_id = auth.uid()
        and r.status in (
          'suspended',
          'temporarily_banned',
          'permanently_banned',
          'deletion_pending',
          'deleted'
        )
        and (r.expires_at is null or r.expires_at > now())
    );
$$;

-- dashboard.read must NOT grant support-note moderation powers.
create or replace function public.support_note_can_moderate()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    public.is_root_owner()
    or public.has_platform_role('platform_admin')
    or public.has_platform_role('root_owner'),
    false
  );
$$;

create or replace function public.support_note_consume_rate_limit(
  target_project_id text,
  target_action text,
  max_attempts integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  window_start timestamptz := to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds);
  current_attempts integer;
begin
  if actor is null then
    return false;
  end if;

  insert into public.project_support_note_rate_limits (user_id, project_id, action, window_started_at, attempts)
  values (actor, target_project_id, target_action, window_start, 1)
  on conflict (user_id, project_id, action, window_started_at)
  do update set attempts = public.project_support_note_rate_limits.attempts + 1
  returning attempts into current_attempts;

  delete from public.project_support_note_rate_limits
  where window_started_at < now() - make_interval(secs => greatest(window_seconds * 4, 3600));

  return current_attempts <= max_attempts;
end;
$$;

revoke all on function public.support_note_consume_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.support_note_consume_rate_limit(text, text, integer, integer)
  to service_role;

create or replace function public.upsert_project_support_note(
  target_project_id text,
  raw_body text
)
returns public.project_support_notes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  normalized text;
  words integer;
  existing public.project_support_notes%rowtype;
  result_row public.project_support_notes%rowtype;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.support_note_actor_eligible() then
    raise exception 'ACCOUNT_RESTRICTED' using errcode = '42501';
  end if;
  if not exists (select 1 from public.support_projects p where p.id = target_project_id and p.is_public = true) then
    raise exception 'PROJECT_NOT_FOUND';
  end if;
  if not public.support_note_consume_rate_limit(target_project_id, 'upsert', 8, 600) then
    raise exception 'RATE_LIMITED';
  end if;

  normalized := public.support_note_normalize_body(raw_body);
  if normalized = '' then
    raise exception 'NOTE_EMPTY';
  end if;
  if char_length(normalized) > 160 then
    raise exception 'NOTE_TOO_LONG';
  end if;
  words := public.support_note_word_count(normalized);
  if words < 1 then
    raise exception 'NOTE_EMPTY';
  end if;
  if words > 20 then
    raise exception 'NOTE_WORD_LIMIT';
  end if;
  if public.support_note_contains_url(normalized) then
    raise exception 'NOTE_LINKS_DENIED';
  end if;

  select * into existing
  from public.project_support_notes n
  where n.project_id = target_project_id
    and n.user_id = actor
    and n.deleted_at is null
  for update;

  if found then
    if existing.moderation_status = 'removed' then
      raise exception 'NOTE_REMOVED';
    end if;
    update public.project_support_notes
    set body = normalized,
        updated_at = now(),
        moderation_status = 'visible'
    where id = existing.id
    returning * into result_row;
  else
    insert into public.project_support_notes (project_id, user_id, body)
    values (target_project_id, actor, normalized)
    returning * into result_row;
  end if;

  return result_row;
end;
$$;

create or replace function public.delete_project_support_note(target_project_id text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  updated integer;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.support_note_consume_rate_limit(target_project_id, 'delete', 8, 600) then
    raise exception 'RATE_LIMITED';
  end if;

  update public.project_support_notes
  set deleted_at = now(),
      updated_at = now()
  where project_id = target_project_id
    and user_id = actor
    and deleted_at is null;

  get diagnostics updated = row_count;
  if updated = 0 then
    raise exception 'NOTE_NOT_FOUND';
  end if;
  return true;
end;
$$;

create or replace function public.list_project_support_notes(
  target_project_id text,
  sort_order text default 'newest',
  page_limit integer default 24,
  cursor_created_at timestamptz default null,
  cursor_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  lim integer := greatest(1, least(coalesce(page_limit, 24), 48));
  sort_newest boolean := lower(coalesce(sort_order, 'newest')) <> 'oldest';
  fetched jsonb := '[]'::jsonb;
  page jsonb := '[]'::jsonb;
  has_more boolean := false;
  next_created timestamptz := null;
  next_id uuid := null;
begin
  if not exists (select 1 from public.support_projects p where p.id = target_project_id and p.is_public = true) then
    raise exception 'PROJECT_NOT_FOUND';
  end if;

  if sort_newest then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'project_id', q.project_id,
        'user_id', q.user_id,
        'body', q.body,
        'created_at', q.created_at,
        'updated_at', q.updated_at
      ) order by q.created_at desc, q.id desc
    ), '[]'::jsonb)
    into fetched
    from (
      select n.id, n.project_id, n.user_id, n.body, n.created_at, n.updated_at
      from public.project_support_notes n
      join public.profiles p on p.id = n.user_id
      where n.project_id = target_project_id
        and n.deleted_at is null
        and n.moderation_status = 'visible'
        and p.deactivated_at is null
        and (
          auth.uid() is null
          or not public.users_are_blocked(auth.uid(), n.user_id)
        )
        and (
          cursor_created_at is null
          or cursor_id is null
          or (n.created_at, n.id) < (cursor_created_at, cursor_id)
        )
      order by n.created_at desc, n.id desc
      limit lim + 1
    ) q;
  else
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'project_id', q.project_id,
        'user_id', q.user_id,
        'body', q.body,
        'created_at', q.created_at,
        'updated_at', q.updated_at
      ) order by q.created_at asc, q.id asc
    ), '[]'::jsonb)
    into fetched
    from (
      select n.id, n.project_id, n.user_id, n.body, n.created_at, n.updated_at
      from public.project_support_notes n
      join public.profiles p on p.id = n.user_id
      where n.project_id = target_project_id
        and n.deleted_at is null
        and n.moderation_status = 'visible'
        and p.deactivated_at is null
        and (
          auth.uid() is null
          or not public.users_are_blocked(auth.uid(), n.user_id)
        )
        and (
          cursor_created_at is null
          or cursor_id is null
          or (n.created_at, n.id) > (cursor_created_at, cursor_id)
        )
      order by n.created_at asc, n.id asc
      limit lim + 1
    ) q;
  end if;

  has_more := jsonb_array_length(fetched) > lim;
  if has_more then
    page := (
      select coalesce(jsonb_agg(elem), '[]'::jsonb)
      from jsonb_array_elements(fetched) with ordinality as t(elem, ord)
      where ord <= lim
    );
    next_created := (page -> (jsonb_array_length(page) - 1) ->> 'created_at')::timestamptz;
    next_id := (page -> (jsonb_array_length(page) - 1) ->> 'id')::uuid;
  else
    page := fetched;
  end if;

  return jsonb_build_object(
    'notes', page,
    'has_more', has_more,
    'next_cursor_created_at', next_created,
    'next_cursor_id', next_id
  );
end;
$$;

create or replace function public.get_my_project_support_note(target_project_id text)
returns public.project_support_notes
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  result_row public.project_support_notes%rowtype;
begin
  if actor is null then
    return null;
  end if;
  select * into result_row
  from public.project_support_notes n
  where n.project_id = target_project_id
    and n.user_id = actor
    and n.deleted_at is null
  limit 1;
  return result_row;
end;
$$;

create or replace function public.report_project_support_note(
  target_note_id uuid,
  report_category text,
  report_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  note_row public.project_support_notes%rowtype;
  safe_category text := lower(btrim(coalesce(report_category, '')));
  safe_description text := nullif(left(btrim(coalesce(report_description, '')), 500), '');
  report_id uuid;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.support_note_actor_eligible() then
    raise exception 'ACCOUNT_RESTRICTED' using errcode = '42501';
  end if;
  if safe_category not in ('spam', 'harassment', 'hate', 'scam', 'other') then
    raise exception 'REPORT_CATEGORY_INVALID';
  end if;

  select * into note_row
  from public.project_support_notes n
  where n.id = target_note_id
    and n.deleted_at is null
    and n.moderation_status = 'visible'
  for share;

  if not found then
    raise exception 'NOTE_NOT_FOUND';
  end if;
  if note_row.user_id = actor then
    raise exception 'CANNOT_REPORT_OWN';
  end if;
  if not public.support_note_consume_rate_limit(note_row.project_id, 'report', 20, 3600) then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.project_support_note_reports (
    note_id, project_id, reporter_user_id, target_user_id, category, description
  ) values (
    note_row.id, note_row.project_id, actor, note_row.user_id, safe_category, safe_description
  )
  on conflict (note_id, reporter_user_id) do update
    set description = excluded.description,
        category = excluded.category,
        status = 'open'
  returning id into report_id;

  return report_id;
end;
$$;

create or replace function public.moderate_project_support_note(
  target_note_id uuid,
  next_status text,
  reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  safe_status text := lower(btrim(coalesce(next_status, '')));
  safe_reason text := nullif(left(btrim(coalesce(reason, '')), 500), '');
  updated integer;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.support_note_can_moderate() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if safe_status not in ('hidden', 'removed', 'visible') then
    raise exception 'STATUS_INVALID';
  end if;

  update public.project_support_notes
  set moderation_status = safe_status,
      moderated_at = now(),
      moderated_by = actor,
      moderation_reason = safe_reason,
      updated_at = now()
  where id = target_note_id
    and deleted_at is null;

  get diagnostics updated = row_count;
  if updated = 0 then
    raise exception 'NOTE_NOT_FOUND';
  end if;
  return true;
end;
$$;

create or replace function public.get_support_project(target_project_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'owner_user_id', p.owner_user_id,
        'is_public', p.is_public
      )
      from public.support_projects p
      where p.id = target_project_id
        and p.is_public = true
    ),
    'null'::jsonb
  );
$$;

revoke all on function public.upsert_project_support_note(text, text) from public, anon;
revoke all on function public.delete_project_support_note(text) from public, anon;
revoke all on function public.list_project_support_notes(text, text, integer, timestamptz, uuid) from public;
revoke all on function public.get_my_project_support_note(text) from public, anon;
revoke all on function public.report_project_support_note(uuid, text, text) from public, anon;
revoke all on function public.moderate_project_support_note(uuid, text, text) from public, anon;
revoke all on function public.get_support_project(text) from public;
revoke all on function public.support_note_actor_eligible() from public, anon;
revoke all on function public.support_note_can_moderate() from public, anon;

grant execute on function public.upsert_project_support_note(text, text) to authenticated;
grant execute on function public.delete_project_support_note(text) to authenticated;
grant execute on function public.list_project_support_notes(text, text, integer, timestamptz, uuid) to anon, authenticated;
grant execute on function public.get_my_project_support_note(text) to authenticated;
grant execute on function public.report_project_support_note(uuid, text, text) to authenticated;
grant execute on function public.moderate_project_support_note(uuid, text, text) to authenticated;
grant execute on function public.get_support_project(text) to anon, authenticated;
grant execute on function public.support_note_actor_eligible() to authenticated;
grant execute on function public.support_note_can_moderate() to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.project_support_notes;
    exception when duplicate_object then
      null;
    end;
  end if;
end;
$$;

alter table public.project_support_notes replica identity full;

commit;
