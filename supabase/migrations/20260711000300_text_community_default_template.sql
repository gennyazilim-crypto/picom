-- Task 438: atomically create a Text community and its owner/default structure.
-- A stable client request UUID makes retries idempotent. PostgreSQL function
-- execution is transactional, so any template failure rolls back the community.

alter table public.communities
  add column if not exists creation_request_id uuid,
  add column if not exists creation_template_id text;

create unique index if not exists communities_owner_creation_request_unique
  on public.communities(owner_id, creation_request_id)
  where creation_request_id is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'communities_creation_template_check') then
    alter table public.communities
      add constraint communities_creation_template_check
      check (
        creation_template_id is null
        or creation_template_id in ('custom', 'gaming', 'study-group', 'developer-team', 'music-community', 'design-studio', 'work-space')
      );
  end if;
end
$$;

create or replace function public.ensure_text_community_default_template(
  target_community_id uuid,
  target_owner_id uuid,
  target_template_id text default 'custom'
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_kind public.community_kind;
  owner_role_id uuid;
  category_id uuid;
  template_definition jsonb;
  category_record record;
  channel_record record;
  channel_type text;
  channel_is_private boolean;
begin
  select community.kind into target_kind
  from public.communities community
  where community.id = target_community_id
    and community.owner_id = target_owner_id;

  if target_kind is distinct from 'text'::public.community_kind then
    raise exception 'TEXT_TEMPLATE_COMMUNITY_INVALID' using errcode = '23514';
  end if;
  if target_template_id not in ('custom', 'gaming', 'study-group', 'developer-team', 'music-community', 'design-studio', 'work-space') then
    raise exception 'TEXT_TEMPLATE_UNSUPPORTED' using errcode = '22023';
  end if;

  template_definition := case target_template_id
    when 'gaming' then '[{"name":"Information","channels":[{"name":"announcements","type":"text"},{"name":"rules","type":"text"}]},{"name":"Channels","channels":[{"name":"general","type":"text"},{"name":"clips","type":"text"},{"name":"squad-voice","type":"voice"}]}]'::jsonb
    when 'study-group' then '[{"name":"Information","channels":[{"name":"announcements","type":"text"},{"name":"resources","type":"text"}]},{"name":"Study","channels":[{"name":"general","type":"text"},{"name":"questions","type":"text"},{"name":"study-room","type":"voice"}]}]'::jsonb
    when 'developer-team' then '[{"name":"Work Space","channels":[{"name":"announcements","type":"text"},{"name":"planning","type":"text"},{"name":"development","type":"text"},{"name":"standup","type":"voice"}]}]'::jsonb
    when 'music-community' then '[{"name":"Music","channels":[{"name":"general","type":"text"},{"name":"new-releases","type":"text"},{"name":"feedback","type":"text"},{"name":"listening-room","type":"voice"}]}]'::jsonb
    when 'design-studio' then '[{"name":"Studio","channels":[{"name":"announcements","type":"text"},{"name":"critique","type":"text"},{"name":"inspiration","type":"text"},{"name":"review-room","type":"voice"}]}]'::jsonb
    when 'work-space' then '[{"name":"Work Space","channels":[{"name":"announcements","type":"text"},{"name":"general","type":"text"},{"name":"project-updates","type":"text"},{"name":"meeting-room","type":"voice","isPrivate":true}]}]'::jsonb
    else '[{"name":"Information","channels":[{"name":"welcome","type":"text","topic":"Start here"}]},{"name":"Channels","channels":[{"name":"general","type":"text","topic":"Start the conversation"}]},{"name":"Voice","channels":[{"name":"focus-room","type":"voice","topic":"A focused voice room"}]}]'::jsonb
  end;

  insert into public.roles(community_id, name, color, level, permissions)
  values (
    target_community_id,
    'Owner',
    '#007571',
    100,
    '{"manageCommunity":true,"manageChannels":true,"manageRoles":true,"manageMembers":true,"moderateMessages":true,"deleteAnyMessage":true,"sendMessages":true,"viewPrivateChannels":true,"createInvites":true,"viewAuditLog":true}'::jsonb
  )
  on conflict do nothing;

  insert into public.roles(community_id, name, color, level, permissions)
  values (target_community_id, 'Member', '#6B7F8C', 10, '{"sendMessages":true}'::jsonb)
  on conflict do nothing;

  select role.id into owner_role_id
  from public.roles role
  where role.community_id = target_community_id
    and lower(role.name) = 'owner'
  order by role.level desc
  limit 1;

  if owner_role_id is null then
    raise exception 'TEXT_TEMPLATE_OWNER_ROLE_MISSING' using errcode = '23514';
  end if;

  insert into public.community_members(community_id, user_id, role_id)
  values (target_community_id, target_owner_id, owner_role_id)
  on conflict (community_id, user_id)
  do update set role_id = excluded.role_id;

  for category_record in
    select item.value as definition, (item.ordinality - 1)::integer as position
    from jsonb_array_elements(template_definition) with ordinality as item(value, ordinality)
  loop
    insert into public.channel_categories(community_id, name, position)
    values (target_community_id, category_record.definition ->> 'name', category_record.position)
    on conflict do nothing;

    select category.id into category_id
    from public.channel_categories category
    where category.community_id = target_community_id
      and lower(category.name) = lower(category_record.definition ->> 'name')
    order by category.position
    limit 1;

    if category_id is null then
      raise exception 'TEXT_TEMPLATE_CATEGORY_MISSING' using errcode = '23514';
    end if;

    for channel_record in
      select item.value as definition, (item.ordinality - 1)::integer as position
      from jsonb_array_elements(category_record.definition -> 'channels') with ordinality as item(value, ordinality)
    loop
      channel_type := channel_record.definition ->> 'type';
      if channel_type not in ('text', 'voice') then
        raise exception 'TEXT_TEMPLATE_CHANNEL_TYPE_INVALID' using errcode = '23514';
      end if;
      channel_is_private := coalesce((channel_record.definition ->> 'isPrivate')::boolean, false);

      insert into public.channels(
        community_id,
        category_id,
        name,
        type,
        topic,
        is_private,
        public_read_enabled,
        position
      ) values (
        target_community_id,
        category_id,
        channel_record.definition ->> 'name',
        channel_type,
        channel_record.definition ->> 'topic',
        channel_is_private,
        not channel_is_private,
        channel_record.position
      )
      on conflict do nothing;
    end loop;
  end loop;
end
$$;

revoke all on function public.ensure_text_community_default_template(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.create_text_community_with_defaults(
  target_creation_request_id uuid,
  community_name text,
  community_description text default null,
  community_icon_url text default null,
  community_accent_color text default '#007571',
  community_visibility text default 'public',
  community_public_read_enabled boolean default true,
  community_template_id text default 'custom'
)
returns setof public.communities
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  requester_id uuid := auth.uid();
  normalized_name text := regexp_replace(btrim(coalesce(community_name, '')), '\s+', ' ', 'g');
  normalized_description text := nullif(btrim(community_description), '');
  normalized_icon_url text := nullif(btrim(community_icon_url), '');
  normalized_template_id text := lower(btrim(coalesce(community_template_id, 'custom')));
  created_community public.communities%rowtype;
begin
  if requester_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if target_creation_request_id is null then raise exception 'CREATION_REQUEST_ID_REQUIRED' using errcode = '22023'; end if;
  if normalized_name = '' or char_length(normalized_name) > 80 then raise exception 'COMMUNITY_NAME_INVALID' using errcode = '22023'; end if;
  if normalized_description is not null and char_length(normalized_description) > 500 then raise exception 'COMMUNITY_DESCRIPTION_INVALID' using errcode = '22023'; end if;
  if normalized_icon_url is not null and (char_length(normalized_icon_url) > 2048 or normalized_icon_url !~* '^https://') then raise exception 'COMMUNITY_ICON_URL_INVALID' using errcode = '22023'; end if;
  if community_accent_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'COMMUNITY_ACCENT_INVALID' using errcode = '22023'; end if;
  if community_visibility not in ('public', 'private') then raise exception 'COMMUNITY_VISIBILITY_INVALID' using errcode = '22023'; end if;
  if normalized_template_id not in ('custom', 'gaming', 'study-group', 'developer-team', 'music-community', 'design-studio', 'work-space') then raise exception 'TEXT_TEMPLATE_UNSUPPORTED' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(requester_id::text || ':' || target_creation_request_id::text, 0));

  select community.* into created_community
  from public.communities community
  where community.owner_id = requester_id
    and community.creation_request_id = target_creation_request_id;

  if found then
    if created_community.kind is distinct from 'text'::public.community_kind
      or created_community.name is distinct from normalized_name
      or created_community.creation_template_id is distinct from normalized_template_id then
      raise exception 'COMMUNITY_CREATION_KEY_CONFLICT' using errcode = '23505';
    end if;
    perform public.ensure_text_community_default_template(created_community.id, requester_id, normalized_template_id);
    return next created_community;
    return;
  end if;

  insert into public.communities(
    owner_id,
    kind,
    name,
    description,
    icon_url,
    accent_color,
    visibility,
    public_read_enabled,
    creation_request_id,
    creation_template_id
  ) values (
    requester_id,
    'text'::public.community_kind,
    normalized_name,
    normalized_description,
    normalized_icon_url,
    community_accent_color,
    community_visibility,
    case when community_visibility = 'public' then community_public_read_enabled else false end,
    target_creation_request_id,
    normalized_template_id
  )
  returning * into created_community;

  perform public.ensure_text_community_default_template(created_community.id, requester_id, normalized_template_id);

  return next created_community;
end
$$;

revoke all on function public.create_text_community_with_defaults(uuid, text, text, text, text, text, boolean, text) from public, anon;
grant execute on function public.create_text_community_with_defaults(uuid, text, text, text, text, text, boolean, text) to authenticated;

comment on function public.create_text_community_with_defaults(uuid, text, text, text, text, text, boolean, text) is
  'Creates a Text community, roles, owner membership, categories, and channels atomically. Stable request UUIDs make retries idempotent.';;
