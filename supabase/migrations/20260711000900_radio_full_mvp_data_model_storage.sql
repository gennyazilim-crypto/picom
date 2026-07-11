-- Task 445: production Radio metadata, schedule, host, listener, reaction, follow, and cover-storage foundation.
-- Audio recording is intentionally not release-scoped; this migration creates no recording bucket or recording URL.

alter table public.radio_sessions drop constraint if exists radio_sessions_status_check;
alter table public.radio_sessions
  add constraint radio_sessions_status_check check (status in ('draft','scheduled','live','ended','cancelled')),
  add column if not exists program_id uuid references public.radio_programs(id) on delete set null,
  add column if not exists scheduled_end_at timestamptz,
  add column if not exists actual_started_at timestamptz,
  add column if not exists listener_chat_channel_id uuid references public.channels(id) on delete set null,
  add column if not exists cover_storage_path text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists is_featured boolean not null default false;

alter table public.radio_programs
  add column if not exists slug text,
  add column if not exists cover_url text,
  add column if not exists cover_storage_path text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists default_duration_minutes integer not null default 60;

alter table public.radio_listeners
  add column if not exists last_heartbeat_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname='radio_sessions_schedule_window_check') then
    alter table public.radio_sessions add constraint radio_sessions_schedule_window_check check (scheduled_end_at is null or scheduled_end_at > starts_at);
  end if;
  if not exists (select 1 from pg_constraint where conname='radio_sessions_cover_storage_path_check') then
    alter table public.radio_sessions add constraint radio_sessions_cover_storage_path_check check (cover_storage_path is null or cover_storage_path ~ '^communities/[0-9a-f-]{36}/radio/[0-9a-f-]{36}/covers/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$');
  end if;
  if not exists (select 1 from pg_constraint where conname='radio_programs_slug_check') then
    alter table public.radio_programs add constraint radio_programs_slug_check check (slug is null or slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
  end if;
  if not exists (select 1 from pg_constraint where conname='radio_programs_duration_check') then
    alter table public.radio_programs add constraint radio_programs_duration_check check (default_duration_minutes between 5 and 720);
  end if;
  if not exists (select 1 from pg_constraint where conname='radio_programs_cover_storage_path_check') then
    alter table public.radio_programs add constraint radio_programs_cover_storage_path_check check (cover_storage_path is null or cover_storage_path ~ '^communities/[0-9a-f-]{36}/radio/programs/[0-9a-f-]{36}/covers/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$');
  end if;
end
$$;

create unique index if not exists radio_programs_community_slug_idx on public.radio_programs(community_id, slug) where slug is not null;
create index if not exists radio_sessions_program_starts_idx on public.radio_sessions(program_id, starts_at desc) where program_id is not null;
create index if not exists radio_sessions_community_status_schedule_idx on public.radio_sessions(community_id, status, starts_at desc);

create table if not exists public.radio_program_schedules (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.radio_programs(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at_local time not null,
  duration_minutes integer not null default 60 check (duration_minutes between 5 and 720),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  effective_from date not null default current_date,
  effective_until date,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_until >= effective_from),
  unique(program_id, weekday, starts_at_local, effective_from)
);

create table if not exists public.radio_program_hosts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.radio_programs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  host_role text not null default 'host' check (host_role in ('host','co_host','producer')),
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  unique(program_id, user_id)
);

create table if not exists public.radio_session_hosts (
  id uuid primary key default gen_random_uuid(),
  radio_session_id uuid not null references public.radio_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  host_role text not null default 'host' check (host_role in ('host','co_host','producer')),
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  unique(radio_session_id, user_id)
);

create table if not exists public.radio_program_follows (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.radio_programs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(program_id, user_id)
);

create table if not exists public.radio_session_reactions (
  id uuid primary key default gen_random_uuid(),
  radio_session_id uuid not null references public.radio_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 32),
  created_at timestamptz not null default now(),
  unique(radio_session_id, user_id, emoji)
);

create index if not exists radio_program_schedules_community_weekday_idx on public.radio_program_schedules(community_id, weekday, starts_at_local) where is_active;
create index if not exists radio_program_hosts_program_idx on public.radio_program_hosts(program_id, assigned_at);
create index if not exists radio_session_hosts_session_idx on public.radio_session_hosts(radio_session_id, assigned_at);
create index if not exists radio_program_follows_user_idx on public.radio_program_follows(user_id, created_at desc);
create index if not exists radio_session_reactions_session_idx on public.radio_session_reactions(radio_session_id, created_at);
create index if not exists radio_listeners_private_activity_idx on public.radio_listeners(user_id, joined_at desc);

create or replace function public.sync_radio_listener_count()
returns trigger language plpgsql security definer set search_path=public as $$
declare target_session_id uuid;
begin
  target_session_id := case when tg_op='DELETE' then old.radio_session_id else new.radio_session_id end;
  update public.radio_sessions session
  set listener_count=(select count(*)::integer from public.radio_listeners listener where listener.radio_session_id=target_session_id and listener.left_at is null)
  where session.id=target_session_id;
  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;

drop trigger if exists radio_listeners_sync_count on public.radio_listeners;
create trigger radio_listeners_sync_count after insert or update of left_at or delete on public.radio_listeners for each row execute function public.sync_radio_listener_count();

drop trigger if exists radio_program_schedules_set_updated_at on public.radio_program_schedules;
create trigger radio_program_schedules_set_updated_at before update on public.radio_program_schedules for each row execute function public.set_audio_updated_at();

create or replace function public.validate_radio_program_schedule_scope()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.radio_programs program where program.id=new.program_id and program.community_id=new.community_id and public.community_has_kind(program.community_id,'radio'::public.community_kind)) then
    raise exception 'RADIO_PROGRAM_SCHEDULE_SCOPE_INVALID' using errcode='23514';
  end if;
  return new;
end
$$;

create or replace function public.validate_radio_host_assignment()
returns trigger language plpgsql security definer set search_path=public as $$
declare target_community_id uuid;
begin
  if tg_table_name='radio_program_hosts' then
    select program.community_id into target_community_id from public.radio_programs program where program.id=new.program_id;
  else
    select session.community_id into target_community_id from public.radio_sessions session where session.id=new.radio_session_id;
  end if;
  if target_community_id is null or not public.community_has_kind(target_community_id,'radio'::public.community_kind) then raise exception 'RADIO_HOST_SOURCE_INVALID' using errcode='23514'; end if;
  if not exists(select 1 from public.community_members member where member.community_id=target_community_id and member.user_id=new.user_id) then raise exception 'RADIO_HOST_MUST_BE_MEMBER' using errcode='23503'; end if;
  return new;
end
$$;

create or replace function public.validate_radio_session_full_scope()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.program_id is not null and not exists(select 1 from public.radio_programs program where program.id=new.program_id and program.community_id=new.community_id) then raise exception 'RADIO_PROGRAM_COMMUNITY_MISMATCH' using errcode='23514'; end if;
  if new.listener_chat_channel_id is not null and not exists(select 1 from public.channels channel where channel.id=new.listener_chat_channel_id and channel.community_id=new.community_id) then raise exception 'RADIO_LISTENER_CHAT_COMMUNITY_MISMATCH' using errcode='23514'; end if;
  if new.cover_storage_path is not null and split_part(new.cover_storage_path,'/',2) <> new.community_id::text then raise exception 'RADIO_COVER_COMMUNITY_MISMATCH' using errcode='23514'; end if;
  if tg_op='INSERT' then
    new.listener_count := 0;
    if new.status in ('ended','cancelled') then raise exception 'RADIO_TERMINAL_INSERT_DENIED' using errcode='23514'; end if;
  elsif new.status is distinct from old.status then
    if old.status in ('ended','cancelled') then raise exception 'RADIO_STATUS_TERMINAL' using errcode='23514'; end if;
    if old.status='live' and new.status not in ('ended','cancelled') then raise exception 'RADIO_STATUS_TRANSITION_INVALID' using errcode='23514'; end if;
  end if;
  if new.status='live' and new.actual_started_at is null then new.actual_started_at := now(); end if;
  if new.status in ('ended','cancelled') and new.ended_at is null then new.ended_at := now(); end if;
  return new;
end
$$;

drop trigger if exists radio_program_schedule_scope on public.radio_program_schedules;
create trigger radio_program_schedule_scope before insert or update of program_id,community_id on public.radio_program_schedules for each row execute function public.validate_radio_program_schedule_scope();
drop trigger if exists radio_program_host_scope on public.radio_program_hosts;
create trigger radio_program_host_scope before insert or update of program_id,user_id on public.radio_program_hosts for each row execute function public.validate_radio_host_assignment();
drop trigger if exists radio_session_host_scope on public.radio_session_hosts;
create trigger radio_session_host_scope before insert or update of radio_session_id,user_id on public.radio_session_hosts for each row execute function public.validate_radio_host_assignment();
drop trigger if exists radio_session_full_scope on public.radio_sessions;
create trigger radio_session_full_scope before insert or update of community_id,program_id,listener_chat_channel_id,cover_storage_path,status on public.radio_sessions for each row execute function public.validate_radio_session_full_scope();

insert into public.radio_program_hosts(program_id,user_id,host_role,assigned_by)
select program.id,program.host_user_id,'host',program.created_by from public.radio_programs program
where program.host_user_id is not null
on conflict(program_id,user_id) do nothing;

create or replace function public.can_view_radio_program(target_program_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.radio_programs program where program.id=target_program_id and (program.is_active or public.can_manage_community_kind(program.community_id,'radio'::public.community_kind,'manageRadioPrograms')) and public.can_view_community_kind_content(program.community_id,'radio'::public.community_kind,null));
$$;

create or replace function public.can_manage_radio_program(target_program_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.radio_programs program where program.id=target_program_id and (public.can_manage_community_kind(program.community_id,'radio'::public.community_kind,'manageRadioPrograms') or exists(select 1 from public.radio_program_hosts host where host.program_id=program.id and host.user_id=auth.uid() and host.host_role in ('host','producer'))));
$$;

create or replace function public.can_manage_radio_session(target_session_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.radio_sessions session where session.id=target_session_id and (session.host_user_id=auth.uid() or public.can_manage_community_kind(session.community_id,'radio'::public.community_kind,'hostRadio') or exists(select 1 from public.radio_session_hosts host where host.radio_session_id=session.id and host.user_id=auth.uid() and host.host_role in ('host','producer'))));
$$;

create or replace function public.can_view_radio_session(target_session_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.radio_sessions session where session.id=target_session_id and ((session.status <> 'draft' and public.can_view_community_kind_content(session.community_id,'radio'::public.community_kind,session.channel_id)) or public.can_manage_radio_session(session.id)));
$$;

grant execute on function public.can_view_radio_program(uuid) to authenticated;
grant execute on function public.can_manage_radio_program(uuid) to authenticated;
grant execute on function public.can_manage_radio_session(uuid) to authenticated;
grant execute on function public.can_view_radio_session(uuid) to authenticated;

alter table public.radio_program_schedules enable row level security;
alter table public.radio_program_hosts enable row level security;
alter table public.radio_session_hosts enable row level security;
alter table public.radio_program_follows enable row level security;
alter table public.radio_session_reactions enable row level security;

drop policy if exists "radio listeners visible to community members" on public.radio_listeners;
drop policy if exists "radio listeners private metadata" on public.radio_listeners;
create policy "radio listeners private metadata" on public.radio_listeners for select to authenticated using (user_id=auth.uid() or public.can_manage_radio_session(radio_session_id));

drop policy if exists "users update own radio listener state" on public.radio_listeners;
create policy "users update own radio listener state" on public.radio_listeners for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and public.can_view_radio_session(radio_session_id));

create policy "radio schedules visible with program" on public.radio_program_schedules for select to authenticated using (public.can_view_radio_program(program_id));
create policy "radio schedules created by program managers" on public.radio_program_schedules for insert to authenticated with check (created_by=auth.uid() and public.can_manage_radio_program(program_id));
create policy "radio schedules updated by program managers" on public.radio_program_schedules for update to authenticated using (public.can_manage_radio_program(program_id)) with check (public.can_manage_radio_program(program_id));
create policy "radio schedules deleted by program managers" on public.radio_program_schedules for delete to authenticated using (public.can_manage_radio_program(program_id));

create policy "radio program hosts visible with program" on public.radio_program_hosts for select to authenticated using (public.can_view_radio_program(program_id));
create policy "radio program hosts assigned by managers" on public.radio_program_hosts for insert to authenticated with check (assigned_by=auth.uid() and exists(select 1 from public.radio_programs program where program.id=program_id and public.can_manage_community_kind(program.community_id,'radio'::public.community_kind,'manageRadioPrograms')));
create policy "radio program hosts changed by managers" on public.radio_program_hosts for update to authenticated using (exists(select 1 from public.radio_programs program where program.id=program_id and public.can_manage_community_kind(program.community_id,'radio'::public.community_kind,'manageRadioPrograms'))) with check (assigned_by=auth.uid());
create policy "radio program hosts removed by managers" on public.radio_program_hosts for delete to authenticated using (exists(select 1 from public.radio_programs program where program.id=program_id and public.can_manage_community_kind(program.community_id,'radio'::public.community_kind,'manageRadioPrograms')));

create policy "radio session hosts visible with session" on public.radio_session_hosts for select to authenticated using (public.can_view_radio_session(radio_session_id));
create policy "radio session hosts assigned by managers" on public.radio_session_hosts for insert to authenticated with check (assigned_by=auth.uid() and public.can_manage_radio_session(radio_session_id));
create policy "radio session hosts changed by managers" on public.radio_session_hosts for update to authenticated using (public.can_manage_radio_session(radio_session_id)) with check (assigned_by=auth.uid());
create policy "radio session hosts removed by managers" on public.radio_session_hosts for delete to authenticated using (public.can_manage_radio_session(radio_session_id));

create policy "users read own radio program follows" on public.radio_program_follows for select to authenticated using (user_id=auth.uid());
create policy "users follow visible radio programs" on public.radio_program_follows for insert to authenticated with check (user_id=auth.uid() and public.can_view_radio_program(program_id));
create policy "users unfollow own radio programs" on public.radio_program_follows for delete to authenticated using (user_id=auth.uid());

create policy "radio reactions follow session visibility" on public.radio_session_reactions for select to authenticated using (public.can_view_radio_session(radio_session_id));
create policy "members add own radio reactions" on public.radio_session_reactions for insert to authenticated with check (user_id=auth.uid() and public.can_view_radio_session(radio_session_id) and exists(select 1 from public.radio_sessions session where session.id=radio_session_id and session.status in ('live','ended') and public.can_manage_community_kind(session.community_id,'radio'::public.community_kind,'listenRadio')));
create policy "users remove own radio reactions" on public.radio_session_reactions for delete to authenticated using (user_id=auth.uid());

grant select,insert,update,delete on public.radio_program_schedules,public.radio_program_hosts,public.radio_session_hosts to authenticated;
grant select,insert,delete on public.radio_program_follows,public.radio_session_reactions to authenticated;
revoke all on public.radio_program_schedules,public.radio_program_hosts,public.radio_session_hosts,public.radio_program_follows,public.radio_session_reactions from anon;

create or replace function public.can_view_radio_cover_object(object_name text)
returns boolean language plpgsql stable security definer set search_path=public,storage as $$
declare parts text[] := storage.foldername(object_name); target_id uuid;
begin
  if object_name ~ '^communities/[0-9a-f-]{36}/radio/[0-9a-f-]{36}/covers/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$' then
    target_id := parts[4]::uuid;
    return exists(select 1 from public.radio_sessions session where session.id=target_id and session.community_id::text=parts[2] and public.can_view_radio_session(session.id));
  elsif object_name ~ '^communities/[0-9a-f-]{36}/radio/programs/[0-9a-f-]{36}/covers/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$' then
    target_id := parts[5]::uuid;
    return exists(select 1 from public.radio_programs program where program.id=target_id and program.community_id::text=parts[2] and public.can_view_radio_program(program.id));
  end if;
  return false;
end
$$;

create or replace function public.can_manage_radio_cover_object(object_name text)
returns boolean language plpgsql stable security definer set search_path=public,storage as $$
declare parts text[] := storage.foldername(object_name); target_id uuid;
begin
  if object_name ~ '^communities/[0-9a-f-]{36}/radio/[0-9a-f-]{36}/covers/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$' then
    target_id := parts[4]::uuid;
    return exists(select 1 from public.radio_sessions session where session.id=target_id and session.community_id::text=parts[2] and public.can_manage_radio_session(session.id));
  elsif object_name ~ '^communities/[0-9a-f-]{36}/radio/programs/[0-9a-f-]{36}/covers/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$' then
    target_id := parts[5]::uuid;
    return exists(select 1 from public.radio_programs program where program.id=target_id and program.community_id::text=parts[2] and public.can_manage_radio_program(program.id));
  end if;
  return false;
end
$$;

grant execute on function public.can_view_radio_cover_object(text) to authenticated;
grant execute on function public.can_manage_radio_cover_object(text) to authenticated;

drop policy if exists "audio covers read follows radio or podcast visibility" on storage.objects;
create policy "audio covers read follows radio or podcast visibility" on storage.objects for select to authenticated using (
  bucket_id='audio-covers' and (
    public.can_view_radio_cover_object(name)
    or (name ~ '^communities/[0-9a-f-]{36}/podcasts/[0-9a-f-]{36}/covers/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$' and public.can_view_podcast_episode(((storage.foldername(name))[4])::uuid))
  )
);

drop policy if exists "audio cover writers manage authorized audio objects" on storage.objects;
create policy "audio cover writers manage authorized audio objects" on storage.objects for insert to authenticated with check (
  bucket_id='audio-covers' and (
    public.can_manage_radio_cover_object(name)
    or (name ~ '^communities/[0-9a-f-]{36}/podcasts/[0-9a-f-]{36}/covers/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$' and public.can_manage_podcast_episode(((storage.foldername(name))[4])::uuid))
  )
);

drop policy if exists "audio cover writers update authorized audio objects" on storage.objects;
create policy "audio cover writers update authorized audio objects" on storage.objects for update to authenticated
using (bucket_id='audio-covers' and (public.can_manage_radio_cover_object(name) or (name like 'communities/%/podcasts/%' and public.can_manage_podcast_episode(((storage.foldername(name))[4])::uuid))))
with check (bucket_id='audio-covers' and (public.can_manage_radio_cover_object(name) or (name like 'communities/%/podcasts/%' and public.can_manage_podcast_episode(((storage.foldername(name))[4])::uuid))));

drop policy if exists "audio cover writers delete authorized audio objects" on storage.objects;
create policy "audio cover writers delete authorized audio objects" on storage.objects for delete to authenticated using (
  bucket_id='audio-covers' and (
    public.can_manage_radio_cover_object(name)
    or (name like 'communities/%/podcasts/%' and public.can_manage_podcast_episode(((storage.foldername(name))[4])::uuid))
  )
);

comment on table public.radio_program_schedules is 'Weekly Radio show schedule metadata; generated sessions remain separate rows.';
comment on table public.radio_program_hosts is 'Explicit show host assignments. Assignment requires existing community membership and manager authorization.';
comment on table public.radio_session_hosts is 'Per-broadcast host and producer assignments; private listener state is not exposed here.';
comment on table public.radio_program_follows is 'User-private follows for recurring Radio programs.';
comment on table public.radio_session_reactions is 'Member reactions to visible live or ended Radio sessions.';
comment on column public.radio_sessions.listener_chat_channel_id is 'Optional same-community chat reference; channel RLS remains authoritative.';
comment on column public.radio_sessions.cover_storage_path is 'Private audio-covers path. Resolve short-lived URLs only after RLS-authorized metadata access.';
comment on table public.radio_sessions is 'Radio session metadata only. Picom does not assume music licensing, automatic recording, or a release-scoped recording asset.';
