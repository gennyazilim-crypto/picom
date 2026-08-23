-- Additive hardening for production Support Notes:
-- 1) Reject HTML-like markup in upsert path
-- 2) Include author projection fields in list payload when available

begin;

create or replace function public.support_note_contains_html(normalized_body text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(normalized_body, '') ~* '<[[:space:]]*/?[[:space:]]*[a-z]';
$$;

create or replace function public.upsert_project_support_note(target_project_id text, raw_body text)
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
  if public.support_note_contains_html(normalized) then
    raise exception 'NOTE_HTML_DENIED';
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
  owner_id uuid;
begin
  if not exists (select 1 from public.support_projects p where p.id = target_project_id and p.is_public = true) then
    raise exception 'PROJECT_NOT_FOUND';
  end if;

  select p.owner_user_id into owner_id
  from public.support_projects p
  where p.id = target_project_id;

  if sort_newest then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'project_id', q.project_id,
        'user_id', q.user_id,
        'body', q.body,
        'created_at', q.created_at,
        'updated_at', q.updated_at,
        'author_display_name', q.display_name,
        'author_username', q.username,
        'author_avatar_url', q.avatar_url,
        'is_project_owner', q.is_project_owner
      ) order by q.created_at desc, q.id desc
    ), '[]'::jsonb)
    into fetched
    from (
      select
        n.id, n.project_id, n.user_id, n.body, n.created_at, n.updated_at,
        p.display_name, p.username, p.avatar_url,
        (owner_id is not null and n.user_id = owner_id) as is_project_owner
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
        'updated_at', q.updated_at,
        'author_display_name', q.display_name,
        'author_username', q.username,
        'author_avatar_url', q.avatar_url,
        'is_project_owner', q.is_project_owner
      ) order by q.created_at asc, q.id asc
    ), '[]'::jsonb)
    into fetched
    from (
      select
        n.id, n.project_id, n.user_id, n.body, n.created_at, n.updated_at,
        p.display_name, p.username, p.avatar_url,
        (owner_id is not null and n.user_id = owner_id) as is_project_owner
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

revoke all on function public.support_note_contains_html(text) from public, anon;
grant execute on function public.support_note_contains_html(text) to authenticated;
grant execute on function public.upsert_project_support_note(text, text) to authenticated;
grant execute on function public.list_project_support_notes(text, text, integer, timestamptz, uuid) to anon, authenticated;

commit;
