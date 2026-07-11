-- Task 439: dedicated Radio-community bootstrap, station structure, and RLS.

alter table public.communities drop constraint if exists communities_creation_template_check;
alter table public.communities add constraint communities_creation_template_check
  check (creation_template_id is null or creation_template_id in ('custom', 'gaming', 'study-group', 'developer-team', 'music-community', 'design-studio', 'work-space', 'radio-default'));

create table if not exists public.radio_community_settings (
  community_id uuid primary key references public.communities(id) on delete cascade,
  schedule_timezone text not null default 'UTC' check (char_length(schedule_timezone) between 1 and 64),
  listener_chat_enabled boolean not null default false,
  listener_chat_channel_id uuid references public.channels(id) on delete set null,
  announcements_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (listener_chat_enabled = false or listener_chat_channel_id is not null)
);

create table if not exists public.radio_programs (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  host_user_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, title)
);

create table if not exists public.radio_announcements (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 4000),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists radio_programs_community_active_idx on public.radio_programs(community_id, is_active, created_at);
create index if not exists radio_announcements_community_published_idx on public.radio_announcements(community_id, published_at desc);
create trigger radio_community_settings_set_updated_at before update on public.radio_community_settings for each row execute function public.set_audio_updated_at();
create trigger radio_programs_set_updated_at before update on public.radio_programs for each row execute function public.set_audio_updated_at();

alter table public.radio_community_settings enable row level security;
alter table public.radio_programs enable row level security;
alter table public.radio_announcements enable row level security;

create policy "radio settings visible with station" on public.radio_community_settings for select to authenticated using (public.can_view_community_audio(community_id, listener_chat_channel_id));
create policy "radio settings managed by station managers" on public.radio_community_settings for update to authenticated using (public.can_manage_community_audio(community_id, 'manageRadioSchedule')) with check (public.can_manage_community_audio(community_id, 'manageRadioSchedule'));
create policy "radio programs visible with station" on public.radio_programs for select to authenticated using (public.can_view_community_audio(community_id, null));
create policy "radio programs created by hosts" on public.radio_programs for insert to authenticated with check (created_by = auth.uid() and public.can_manage_community_audio(community_id, 'hostRadio'));
create policy "radio programs managed by hosts" on public.radio_programs for update to authenticated using (public.can_manage_community_audio(community_id, 'hostRadio')) with check (public.can_manage_community_audio(community_id, 'hostRadio'));
create policy "radio programs deleted by hosts" on public.radio_programs for delete to authenticated using (public.can_manage_community_audio(community_id, 'hostRadio'));
create policy "radio announcements visible with station" on public.radio_announcements for select to authenticated using (public.can_view_community_audio(community_id, null));
create policy "radio announcements published by managers" on public.radio_announcements for insert to authenticated with check (author_id = auth.uid() and public.can_manage_community_audio(community_id, 'publishRadioAnnouncements'));
create policy "radio announcements managed by managers" on public.radio_announcements for update to authenticated using (author_id = auth.uid() or public.can_manage_community_audio(community_id, 'publishRadioAnnouncements')) with check (author_id = auth.uid() or public.can_manage_community_audio(community_id, 'publishRadioAnnouncements'));
create policy "radio announcements deleted by managers" on public.radio_announcements for delete to authenticated using (author_id = auth.uid() or public.can_manage_community_audio(community_id, 'publishRadioAnnouncements'));

revoke all on public.radio_community_settings, public.radio_programs, public.radio_announcements from anon;
grant select, update on public.radio_community_settings to authenticated;
grant select, insert, update, delete on public.radio_programs, public.radio_announcements to authenticated;

create or replace function public.ensure_radio_community_default_template(target_community_id uuid, target_owner_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  target_kind public.community_kind;
  owner_role_id uuid;
begin
  select community.kind into target_kind from public.communities community where community.id = target_community_id and community.owner_id = target_owner_id;
  if target_kind is distinct from 'radio'::public.community_kind then raise exception 'RADIO_TEMPLATE_COMMUNITY_INVALID' using errcode = '23514'; end if;

  insert into public.roles(community_id, name, color, level, permissions) values
    (target_community_id, 'Owner', '#007571', 100, '{"manageCommunity":true,"manageRoles":true,"manageMembers":true,"hostRadio":true,"manageRadioSchedule":true,"manageRadioPrograms":true,"publishRadioAnnouncements":true,"createInvites":true,"viewAuditLog":true}'::jsonb),
    (target_community_id, 'Radio Host', '#10C2BB', 50, '{"hostRadio":true,"manageRadioSchedule":true}'::jsonb),
    (target_community_id, 'Member', '#6B7F8C', 10, '{"listenRadio":true}'::jsonb)
  on conflict do nothing;

  select role.id into owner_role_id from public.roles role where role.community_id = target_community_id and lower(role.name) = 'owner' order by role.level desc limit 1;
  if owner_role_id is null then raise exception 'RADIO_TEMPLATE_OWNER_ROLE_MISSING' using errcode = '23514'; end if;
  insert into public.community_members(community_id, user_id, role_id) values (target_community_id, target_owner_id, owner_role_id)
  on conflict (community_id, user_id) do update set role_id = excluded.role_id;
  insert into public.radio_community_settings(community_id, schedule_timezone, listener_chat_enabled, listener_chat_channel_id, announcements_enabled)
  values (target_community_id, 'UTC', false, null, true) on conflict (community_id) do nothing;
end
$$;

revoke all on function public.ensure_radio_community_default_template(uuid, uuid) from public, anon, authenticated;

create or replace function public.create_radio_community_with_defaults(
  target_creation_request_id uuid,
  community_name text,
  community_description text default null,
  community_icon_url text default null,
  community_accent_color text default '#007571',
  community_visibility text default 'public',
  community_public_read_enabled boolean default true
)
returns setof public.communities language plpgsql security definer set search_path = public, extensions as $$
declare
  requester_id uuid := auth.uid();
  normalized_name text := regexp_replace(btrim(coalesce(community_name, '')), '\s+', ' ', 'g');
  normalized_description text := nullif(btrim(community_description), '');
  normalized_icon_url text := nullif(btrim(community_icon_url), '');
  created_community public.communities%rowtype;
begin
  if requester_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if target_creation_request_id is null then raise exception 'CREATION_REQUEST_ID_REQUIRED' using errcode = '22023'; end if;
  if normalized_name = '' or char_length(normalized_name) > 80 then raise exception 'COMMUNITY_NAME_INVALID' using errcode = '22023'; end if;
  if normalized_description is not null and char_length(normalized_description) > 500 then raise exception 'COMMUNITY_DESCRIPTION_INVALID' using errcode = '22023'; end if;
  if normalized_icon_url is not null and (char_length(normalized_icon_url) > 2048 or normalized_icon_url !~* '^https://') then raise exception 'COMMUNITY_ICON_URL_INVALID' using errcode = '22023'; end if;
  if community_accent_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'COMMUNITY_ACCENT_INVALID' using errcode = '22023'; end if;
  if community_visibility not in ('public', 'private') then raise exception 'COMMUNITY_VISIBILITY_INVALID' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(requester_id::text || ':' || target_creation_request_id::text, 0));
  select community.* into created_community from public.communities community where community.owner_id = requester_id and community.creation_request_id = target_creation_request_id;
  if found then
    if created_community.kind is distinct from 'radio'::public.community_kind or created_community.name is distinct from normalized_name or created_community.creation_template_id is distinct from 'radio-default' then raise exception 'COMMUNITY_CREATION_KEY_CONFLICT' using errcode = '23505'; end if;
    perform public.ensure_radio_community_default_template(created_community.id, requester_id);
    return next created_community;
    return;
  end if;

  insert into public.communities(owner_id, kind, name, description, icon_url, accent_color, visibility, public_read_enabled, creation_request_id, creation_template_id)
  values (requester_id, 'radio'::public.community_kind, normalized_name, normalized_description, normalized_icon_url, community_accent_color, community_visibility, case when community_visibility = 'public' then community_public_read_enabled else false end, target_creation_request_id, 'radio-default')
  returning * into created_community;
  perform public.ensure_radio_community_default_template(created_community.id, requester_id);
  return next created_community;
end
$$;

revoke all on function public.create_radio_community_with_defaults(uuid, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.create_radio_community_with_defaults(uuid, text, text, text, text, text, boolean) to authenticated;

comment on function public.create_radio_community_with_defaults(uuid, text, text, text, text, text, boolean) is
  'Atomically creates an idempotent Radio community, station roles, owner membership, and safe empty UTC schedule settings without text channels.';
