-- Task 495: type-aware text, Radio, and Podcast structure management.
begin;

create table if not exists public.community_structure_sections (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  community_kind public.community_kind not null,
  section_type text not null,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  position integer not null default 0 check (position >= 0),
  visibility text not null default 'members' check (visibility in ('public','members','managers')),
  is_enabled boolean not null default true,
  is_required boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, section_type),
  check (
    (community_kind='radio' and section_type in ('radio_programs','radio_schedule','radio_hosts','radio_listener_chat'))
    or (community_kind='podcast' and section_type in ('podcast_series','podcast_episodes','podcast_drafts','podcast_publishers','podcast_listener_discussion'))
  )
);

create index if not exists community_structure_sections_order_idx on public.community_structure_sections(community_id,position,id);

create or replace function public.validate_community_structure_section() returns trigger language plpgsql security definer set search_path=public as $$
declare actual_kind public.community_kind;
begin
  select kind into actual_kind from public.communities where id=new.community_id;
  if actual_kind is null or actual_kind<>new.community_kind or actual_kind='text' then raise exception 'COMMUNITY_STRUCTURE_KIND_MISMATCH' using errcode='23514'; end if;
  if new.is_required then new.is_enabled:=true; end if;
  new.label:=btrim(new.label); new.updated_at:=now(); return new;
end $$;
drop trigger if exists community_structure_section_guard on public.community_structure_sections;
create trigger community_structure_section_guard before insert or update on public.community_structure_sections for each row execute function public.validate_community_structure_section();

create or replace function public.seed_community_structure_defaults(target_community_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare target_kind public.community_kind;
begin
  select kind into target_kind from public.communities where id=target_community_id;
  if target_kind='radio' then
    insert into public.community_structure_sections(community_id,community_kind,section_type,label,position,visibility,is_required)
    values (target_community_id,'radio','radio_programs','Programs',0,'public',true),(target_community_id,'radio','radio_schedule','Schedule',1,'public',true),(target_community_id,'radio','radio_hosts','Hosts',2,'members',false),(target_community_id,'radio','radio_listener_chat','Listener chat',3,'members',false) on conflict(community_id,section_type) do nothing;
  elsif target_kind='podcast' then
    insert into public.community_structure_sections(community_id,community_kind,section_type,label,position,visibility,is_required)
    values (target_community_id,'podcast','podcast_series','Series',0,'public',true),(target_community_id,'podcast','podcast_episodes','Episodes',1,'public',true),(target_community_id,'podcast','podcast_drafts','Drafts',2,'managers',false),(target_community_id,'podcast','podcast_publishers','Publishers',3,'members',false),(target_community_id,'podcast','podcast_listener_discussion','Listener discussion',4,'members',false) on conflict(community_id,section_type) do nothing;
  end if;
end $$;

create or replace function public.seed_new_community_structure() returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.seed_community_structure_defaults(new.id); return new; end $$;
drop trigger if exists seed_new_community_structure on public.communities;
create trigger seed_new_community_structure after insert on public.communities for each row execute function public.seed_new_community_structure();
do $$ declare item record; begin for item in select id from public.communities where kind in ('radio','podcast') loop perform public.seed_community_structure_defaults(item.id); end loop; end $$;

create or replace function public.can_manage_structure(target_community_id uuid,target_kind public.community_kind) returns boolean language sql stable security definer set search_path=public as $$
  select case when target_kind='radio' then public.can_manage_community_kind(target_community_id,'radio','manageRadioCommunity') when target_kind='podcast' then public.can_manage_community_kind(target_community_id,'podcast','managePodcastCommunity') else public.can_manage_channels_v2(target_community_id) end;
$$;

create or replace function public.list_community_structure_sections(target_community_id uuid) returns setof public.community_structure_sections language plpgsql stable security definer set search_path=public as $$
declare target_kind public.community_kind;
begin select kind into target_kind from public.communities where id=target_community_id; if not public.can_manage_structure(target_community_id,target_kind) then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if; return query select * from public.community_structure_sections where community_id=target_community_id order by position,id; end $$;

create or replace function public.update_community_structure_section(target_section_id uuid,next_label text,next_visibility text,next_enabled boolean) returns setof public.community_structure_sections language plpgsql security definer set search_path=public as $$
declare current_row public.community_structure_sections%rowtype;
begin select * into current_row from public.community_structure_sections where id=target_section_id for update; if not found then raise exception 'SECTION_NOT_FOUND'; end if; if not public.can_manage_structure(current_row.community_id,current_row.community_kind) then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if; if next_visibility not in ('public','members','managers') or char_length(btrim(next_label)) not between 1 and 80 then raise exception 'SECTION_VALIDATION_FAILED' using errcode='22023'; end if; if current_row.is_required and not next_enabled then raise exception 'REQUIRED_SECTION_RECOVERY_REQUIRED' using errcode='23514'; end if; update public.community_structure_sections set label=btrim(next_label),visibility=next_visibility,is_enabled=next_enabled where id=target_section_id returning * into current_row; return next current_row; end $$;

create or replace function public.move_community_structure_section(target_section_id uuid,move_direction text) returns void language plpgsql security definer set search_path=public as $$
declare current_row public.community_structure_sections%rowtype; target_row public.community_structure_sections%rowtype;
begin select * into current_row from public.community_structure_sections where id=target_section_id for update; if not found then raise exception 'SECTION_NOT_FOUND'; end if; if not public.can_manage_structure(current_row.community_id,current_row.community_kind) then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if; if move_direction='up' then select * into target_row from public.community_structure_sections where community_id=current_row.community_id and position<current_row.position order by position desc limit 1 for update; elsif move_direction='down' then select * into target_row from public.community_structure_sections where community_id=current_row.community_id and position>current_row.position order by position asc limit 1 for update; else raise exception 'MOVE_DIRECTION_INVALID' using errcode='22023'; end if; if target_row.id is null then return; end if; update public.community_structure_sections set position=case when id=current_row.id then target_row.position else current_row.position end where id in(current_row.id,target_row.id); end $$;

create or replace function public.delete_community_structure_section(target_section_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare current_row public.community_structure_sections%rowtype;
begin select * into current_row from public.community_structure_sections where id=target_section_id for update; if not found then raise exception 'SECTION_NOT_FOUND'; end if; if not public.can_manage_structure(current_row.community_id,current_row.community_kind) then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if; if current_row.is_required then raise exception 'REQUIRED_SECTION_RECOVERY_REQUIRED' using errcode='23514'; end if; delete from public.community_structure_sections where id=target_section_id; with ordered as(select id,row_number() over(order by position,id)-1 as next_position from public.community_structure_sections where community_id=current_row.community_id) update public.community_structure_sections target set position=ordered.next_position from ordered where target.id=ordered.id; end $$;

create or replace function public.restore_community_structure_defaults(target_community_id uuid) returns void language plpgsql security definer set search_path=public as $$ declare target_kind public.community_kind; begin select kind into target_kind from public.communities where id=target_community_id; if not public.can_manage_structure(target_community_id,target_kind) then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if; perform public.seed_community_structure_defaults(target_community_id); end $$;

create or replace function public.create_managed_category(target_community_id uuid,category_name text) returns setof public.channel_categories language plpgsql security definer set search_path=public as $$ declare created public.channel_categories%rowtype; begin if not public.community_has_kind(target_community_id,'text') or not public.can_manage_channels_v2(target_community_id) then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if; if char_length(btrim(category_name)) not between 1 and 80 then raise exception 'CATEGORY_NAME_INVALID' using errcode='22023'; end if; insert into public.channel_categories(community_id,name,position) values(target_community_id,btrim(category_name),coalesce((select max(position)+1 from public.channel_categories where community_id=target_community_id),0)) returning * into created; return next created; end $$;
create or replace function public.rename_managed_category(target_category_id uuid,category_name text,expected_community_id uuid) returns void language plpgsql security definer set search_path=public as $$ begin if not public.can_manage_channels_v2(expected_community_id) then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if; if char_length(btrim(category_name)) not between 1 and 80 then raise exception 'CATEGORY_NAME_INVALID' using errcode='22023'; end if; update public.channel_categories set name=btrim(category_name) where id=target_category_id and community_id=expected_community_id; if not found then raise exception 'CATEGORY_NOT_FOUND'; end if; end $$;
create or replace function public.delete_managed_category(target_category_id uuid,expected_community_id uuid) returns void language plpgsql security definer set search_path=public as $$ declare fallback_id uuid; category_count integer; begin if not public.can_manage_channels_v2(expected_community_id) then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if; select count(*) into category_count from public.channel_categories where community_id=expected_community_id; if category_count<=1 then raise exception 'LAST_CATEGORY_REQUIRED' using errcode='23514'; end if; select id into fallback_id from public.channel_categories where community_id=expected_community_id and id<>target_category_id order by position,id limit 1; if fallback_id is null then raise exception 'CATEGORY_NOT_FOUND'; end if; update public.channels set category_id=fallback_id where community_id=expected_community_id and category_id=target_category_id; delete from public.channel_categories where id=target_category_id and community_id=expected_community_id; if not found then raise exception 'CATEGORY_NOT_FOUND'; end if; with ordered as(select id,row_number() over(order by position,id)-1 as next_position from public.channel_categories where community_id=expected_community_id) update public.channel_categories target set position=ordered.next_position from ordered where target.id=ordered.id; end $$;
create or replace function public.move_managed_category(target_category_id uuid,expected_community_id uuid,move_direction text) returns void language plpgsql security definer set search_path=public as $$ declare current_position integer; target_id uuid; target_position integer; begin if not public.can_manage_channels_v2(expected_community_id) then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if; select position into current_position from public.channel_categories where id=target_category_id and community_id=expected_community_id for update; if current_position is null then raise exception 'CATEGORY_NOT_FOUND'; end if; if move_direction='up' then select id,position into target_id,target_position from public.channel_categories where community_id=expected_community_id and position<current_position order by position desc limit 1 for update; elsif move_direction='down' then select id,position into target_id,target_position from public.channel_categories where community_id=expected_community_id and position>current_position order by position asc limit 1 for update; else raise exception 'MOVE_DIRECTION_INVALID'; end if; if target_id is null then return; end if; update public.channel_categories set position=case when id=target_category_id then target_position else current_position end where id in(target_category_id,target_id); end $$;
create or replace function public.move_managed_channel(target_channel_id uuid,expected_community_id uuid,expected_category_id uuid,move_direction text) returns void language plpgsql security definer set search_path=public as $$ declare current_position integer; target_id uuid; target_position integer; begin if not public.can_manage_channels_v2(expected_community_id) then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if; select position into current_position from public.channels where id=target_channel_id and community_id=expected_community_id and category_id=expected_category_id for update; if current_position is null then raise exception 'CHANNEL_NOT_FOUND'; end if; if move_direction='up' then select id,position into target_id,target_position from public.channels where community_id=expected_community_id and category_id=expected_category_id and position<current_position order by position desc limit 1 for update; elsif move_direction='down' then select id,position into target_id,target_position from public.channels where community_id=expected_community_id and category_id=expected_category_id and position>current_position order by position asc limit 1 for update; else raise exception 'MOVE_DIRECTION_INVALID'; end if; if target_id is null then return; end if; update public.channels set position=case when id=target_channel_id then target_position else current_position end where id in(target_channel_id,target_id); end $$;

create or replace function public.list_community_permission_overrides_for_scope(target_community_id uuid,target_scope_type text,target_scope_id uuid) returns setof public.community_permission_overrides language plpgsql stable security definer set search_path=public as $$ begin if not (public.is_community_owner(target_community_id) or public.has_community_permission(target_community_id,'managePermissionOverrides')) then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if; return query select * from public.community_permission_overrides where community_id=target_community_id and scope_type=target_scope_type and scope_id=target_scope_id order by role_id,permission_key; end $$;

alter table public.community_structure_sections enable row level security;
drop policy if exists community_structure_sections_visible on public.community_structure_sections;
create policy community_structure_sections_visible on public.community_structure_sections for select to authenticated using ((visibility='public' and public.can_view_community_kind_content(community_id,community_kind,null)) or (visibility='members' and public.is_community_member(community_id)) or (visibility='managers' and public.can_manage_structure(community_id,community_kind)));
revoke all on public.community_structure_sections from anon,authenticated;
grant select on public.community_structure_sections to authenticated;
revoke all on function public.can_manage_structure(uuid,public.community_kind),public.list_community_structure_sections(uuid),public.update_community_structure_section(uuid,text,text,boolean),public.move_community_structure_section(uuid,text),public.delete_community_structure_section(uuid),public.restore_community_structure_defaults(uuid),public.create_managed_category(uuid,text),public.rename_managed_category(uuid,text,uuid),public.delete_managed_category(uuid,uuid),public.move_managed_category(uuid,uuid,text),public.move_managed_channel(uuid,uuid,uuid,text),public.list_community_permission_overrides_for_scope(uuid,text,uuid) from public,anon;
grant execute on function public.list_community_structure_sections(uuid),public.update_community_structure_section(uuid,text,text,boolean),public.move_community_structure_section(uuid,text),public.delete_community_structure_section(uuid),public.restore_community_structure_defaults(uuid),public.create_managed_category(uuid,text),public.rename_managed_category(uuid,text,uuid),public.delete_managed_category(uuid,uuid),public.move_managed_category(uuid,uuid,text),public.move_managed_channel(uuid,uuid,uuid,text),public.list_community_permission_overrides_for_scope(uuid,text,uuid) to authenticated;
comment on table public.community_structure_sections is 'Type-compatible Radio and Podcast navigation structure. Content rows remain in their authoritative tables.';;
