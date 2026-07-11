-- Task 492: canonical community role hierarchy, grants, scoped overrides, and owner safeguards.
begin;

create table if not exists public.community_permission_definitions (
  permission_key text primary key check (permission_key ~ '^[a-z][A-Za-z0-9]{2,63}$'),
  category text not null check (category in ('common','text','voice','radio','podcast')),
  allowed_kinds text[] not null default array['text','radio','podcast']::text[] check (cardinality(allowed_kinds) > 0 and allowed_kinds <@ array['text','radio','podcast']::text[]),
  delegable boolean not null default true,
  owner_reserved boolean not null default false,
  description text not null check (char_length(description) between 4 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.community_permission_definitions(permission_key, category, allowed_kinds, delegable, owner_reserved, description) values
  ('manageCommunity','common',array['text','radio','podcast'],true,false,'Manage ordinary community settings.'),
  ('manageChannels','common',array['text','radio','podcast'],true,false,'Create, edit, order, and archive channels.'),
  ('manageCategories','common',array['text','radio','podcast'],true,false,'Create, edit, order, and archive channel categories.'),
  ('managePermissionOverrides','common',array['text','radio','podcast'],true,false,'Manage approved resource-scoped role overrides.'),
  ('manageRoles','common',array['text','radio','podcast'],true,false,'Manage roles below the actor hierarchy.'),
  ('manageMembers','common',array['text','radio','podcast'],true,false,'Manage ordinary community members.'),
  ('moderateMembers','common',array['text','radio','podcast'],true,false,'Apply approved moderation actions to lower members.'),
  ('moderateMessages','common',array['text','radio','podcast'],true,false,'Moderate message content in visible channels.'),
  ('deleteAnyMessage','common',array['text','radio','podcast'],true,false,'Delete another author message under moderation policy.'),
  ('createInvites','common',array['text','radio','podcast'],true,false,'Create community invitations.'),
  ('viewInsights','common',array['text','radio','podcast'],true,false,'View privacy-safe community insights.'),
  ('viewAuditLog','common',array['text','radio','podcast'],true,false,'View the community audit trail.'),
  ('manageTextCommunity','text',array['text'],true,false,'Manage Text community configuration.'),
  ('viewChannel','text',array['text'],true,false,'View a Text channel and its permitted content.'),
  ('sendMessages','text',array['text'],true,false,'Send normal text messages and replies.'),
  ('sendAnnouncements','text',array['text'],true,false,'Publish messages in announcement channels.'),
  ('uploadAttachments','text',array['text'],true,false,'Upload validated message attachments.'),
  ('addReactions','text',array['text'],true,false,'Add or remove own message reactions.'),
  ('viewPrivateChannels','text',array['text'],true,false,'View private channels granted to this role.'),
  ('joinVoice','voice',array['text'],true,false,'Join an accessible voice channel.'),
  ('speakInVoice','voice',array['text'],true,false,'Publish microphone audio in a voice channel.'),
  ('shareScreen','voice',array['text'],true,false,'Publish an approved screen-share track.'),
  ('viewRadioContent','radio',array['radio'],true,false,'View public or member Radio content.'),
  ('listenRadio','radio',array['radio'],true,false,'Listen to an accessible Radio session.'),
  ('hostRadio','radio',array['radio'],true,false,'Host an assigned Radio session.'),
  ('manageRadioCommunity','radio',array['radio'],true,false,'Manage Radio community settings.'),
  ('manageRadioSchedule','radio',array['radio'],true,false,'Manage Radio schedules.'),
  ('manageRadioPrograms','radio',array['radio'],true,false,'Create and edit Radio programs.'),
  ('manageRadioHosts','radio',array['radio'],true,false,'Assign Radio producers and hosts below the actor.'),
  ('publishRadioAnnouncements','radio',array['radio'],true,false,'Publish Radio announcements.'),
  ('moderateRadioComments','radio',array['radio'],true,false,'Moderate Radio comments.'),
  ('viewPodcastContent','podcast',array['podcast'],true,false,'View accessible Podcast content.'),
  ('listenPodcasts','podcast',array['podcast'],true,false,'Play published Podcast episodes.'),
  ('createPodcastDrafts','podcast',array['podcast'],true,false,'Create Podcast episode drafts.'),
  ('publishPodcasts','podcast',array['podcast'],true,false,'Publish Podcast episodes.'),
  ('editPodcastMetadata','podcast',array['podcast'],true,false,'Edit Podcast episode metadata.'),
  ('archivePodcastEpisodes','podcast',array['podcast'],true,false,'Archive Podcast episodes.'),
  ('moderatePodcastEpisodes','podcast',array['podcast'],true,false,'Moderate Podcast episode visibility.'),
  ('managePodcastSeries','podcast',array['podcast'],true,false,'Create and edit Podcast series.'),
  ('commentOnPodcasts','podcast',array['podcast'],true,false,'Comment on accessible Podcast episodes.'),
  ('reactToPodcasts','podcast',array['podcast'],true,false,'React to accessible Podcast episodes.'),
  ('moderatePodcastComments','podcast',array['podcast'],true,false,'Moderate Podcast comments.'),
  ('managePodcastCommunity','podcast',array['podcast'],true,false,'Manage Podcast community settings.')
on conflict (permission_key) do update set category=excluded.category, allowed_kinds=excluded.allowed_kinds, delegable=excluded.delegable, owner_reserved=excluded.owner_reserved, description=excluded.description, updated_at=now();

alter table public.roles add column if not exists system_key text;
alter table public.roles add column if not exists is_default boolean not null default false;
alter table public.roles add column if not exists permissions_version smallint not null default 1;

update public.roles set system_key=case lower(name) when 'owner' then 'owner' when 'admin' then 'admin' when 'moderator' then 'moderator' when 'member' then 'member' else null end where system_key is null;
update public.roles set is_default=true where system_key='member';

do $$ begin
  if not exists(select 1 from pg_constraint where conname='roles_system_key_check') then alter table public.roles add constraint roles_system_key_check check(system_key is null or system_key in ('owner','admin','moderator','member')); end if;
  if not exists(select 1 from pg_constraint where conname='roles_permissions_version_check') then alter table public.roles add constraint roles_permissions_version_check check(permissions_version between 1 and 32767); end if;
end $$;

create unique index if not exists roles_community_system_key_unique on public.roles(community_id,system_key) where system_key is not null;
create unique index if not exists roles_community_default_unique on public.roles(community_id) where is_default;
create index if not exists roles_community_hierarchy_lookup on public.roles(community_id,level desc,id);

create or replace function public.enforce_community_role_invariants() returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='DELETE' then
    if old.system_key='owner' and exists(select 1 from public.communities where id=old.community_id) then raise exception 'OWNER_ROLE_DELETE_FORBIDDEN' using errcode='42501'; end if;
    if old.system_key='member' and exists(select 1 from public.communities where id=old.community_id) then raise exception 'DEFAULT_ROLE_DELETE_FORBIDDEN' using errcode='42501'; end if;
    return old;
  end if;
  if new.system_key is null then new.system_key:=case lower(new.name) when 'owner' then 'owner' when 'admin' then 'admin' when 'moderator' then 'moderator' when 'member' then 'member' else null end; end if;
  if new.system_key='owner' and (lower(new.name)<>'owner' or new.level<>100 or new.is_default) then raise exception 'OWNER_ROLE_INVARIANT' using errcode='23514'; end if;
  if new.system_key<>'owner' and new.level>=100 then raise exception 'OWNER_POSITION_RESERVED' using errcode='23514'; end if;
  if new.system_key='admin' and new.level not between 80 and 99 then raise exception 'ADMIN_ROLE_POSITION_INVALID' using errcode='23514'; end if;
  if new.system_key='moderator' and new.level not between 60 and 79 then raise exception 'MODERATOR_ROLE_POSITION_INVALID' using errcode='23514'; end if;
  if new.system_key='member' and new.level not between 0 and 59 then raise exception 'MEMBER_ROLE_POSITION_INVALID' using errcode='23514'; end if;
  if new.is_default and new.system_key<>'member' then raise exception 'DEFAULT_ROLE_INVALID' using errcode='23514'; end if;
  if tg_op='UPDATE' and old.system_key='owner' and (new.community_id<>old.community_id or new.system_key is distinct from old.system_key or new.level<>100 or lower(new.name)<>'owner') then raise exception 'OWNER_ROLE_MUTATION_FORBIDDEN' using errcode='42501'; end if;
  return new;
end; $$;

drop trigger if exists community_role_invariants on public.roles;
create trigger community_role_invariants before insert or update or delete on public.roles for each row execute function public.enforce_community_role_invariants();

create table if not exists public.community_role_permissions (
  id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.community_permission_definitions(permission_key) on delete restrict,
  allowed boolean not null, created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(role_id,permission_key)
);

create table if not exists public.community_permission_overrides (
  id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  scope_type text not null check(scope_type in ('category','channel','radio_program','podcast_series')), scope_id uuid not null,
  permission_key text not null references public.community_permission_definitions(permission_key) on delete restrict,
  effect text not null check(effect in ('allow','deny')), created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(role_id,scope_type,scope_id,permission_key)
);

create index if not exists community_role_permissions_lookup on public.community_role_permissions(community_id,role_id,permission_key);
create index if not exists community_permission_overrides_scope_lookup on public.community_permission_overrides(community_id,scope_type,scope_id,role_id,permission_key);
create index if not exists community_permission_overrides_role_lookup on public.community_permission_overrides(role_id,permission_key);

create or replace function public.builtin_role_permission_keys(target_kind text,target_system_key text) returns text[] language sql stable security definer set search_path=public as $$
  select case
    when target_system_key in ('owner','admin') then coalesce(array(select permission_key from public.community_permission_definitions where target_kind=any(allowed_kinds) order by permission_key),array[]::text[])
    when target_system_key='moderator' then case target_kind
      when 'text' then array['manageMembers','moderateMembers','moderateMessages','deleteAnyMessage','createInvites','viewChannel','sendMessages','uploadAttachments','addReactions','joinVoice','speakInVoice','shareScreen']
      when 'radio' then array['manageMembers','moderateMembers','moderateMessages','deleteAnyMessage','createInvites','viewRadioContent','listenRadio','moderateRadioComments']
      when 'podcast' then array['manageMembers','moderateMembers','moderateMessages','deleteAnyMessage','createInvites','viewPodcastContent','listenPodcasts','moderatePodcastEpisodes','commentOnPodcasts','reactToPodcasts','moderatePodcastComments'] end
    when target_system_key='member' then case target_kind
      when 'text' then array['viewChannel','sendMessages','uploadAttachments','addReactions','joinVoice','speakInVoice','shareScreen']
      when 'radio' then array['viewRadioContent','listenRadio']
      when 'podcast' then array['viewPodcastContent','listenPodcasts','commentOnPodcasts','reactToPodcasts'] end
    else array[]::text[] end;
$$;

insert into public.community_role_permissions(community_id,role_id,permission_key,allowed)
select role.community_id,role.id,entry.key,(entry.value)::boolean from public.roles role cross join lateral jsonb_each_text(coalesce(role.permissions,'{}'::jsonb)) entry join public.community_permission_definitions definition on definition.permission_key=entry.key where entry.value in ('true','false')
on conflict(role_id,permission_key) do update set allowed=excluded.allowed,updated_at=now();

insert into public.community_role_permissions(community_id,role_id,permission_key,allowed)
select role.community_id,role.id,permission_key,true from public.roles role join public.communities community on community.id=role.community_id cross join lateral unnest(public.builtin_role_permission_keys(community.kind::text,role.system_key)) permission_key
on conflict(role_id,permission_key) do nothing;

update public.roles role set permissions=coalesce((select jsonb_object_agg(permission.permission_key,permission.allowed order by permission.permission_key) from public.community_role_permissions permission where permission.role_id=role.id),'{}'::jsonb),permissions_version=2;

create or replace function public.validate_role_permission_scope() returns trigger language plpgsql set search_path=public as $$
declare role_community uuid; community_kind text;
begin
  select community_id into role_community from public.roles where id=new.role_id;
  select kind::text into community_kind from public.communities where id=new.community_id;
  if role_community is distinct from new.community_id then raise exception 'ROLE_COMMUNITY_MISMATCH' using errcode='23514'; end if;
  if not exists(select 1 from public.community_permission_definitions where permission_key=new.permission_key and community_kind=any(allowed_kinds)) then raise exception 'PERMISSION_KIND_MISMATCH' using errcode='23514'; end if;
  return new;
end; $$;

drop trigger if exists community_role_permission_scope on public.community_role_permissions;
create trigger community_role_permission_scope before insert or update on public.community_role_permissions for each row execute function public.validate_role_permission_scope();

create or replace function public.permission_scope_belongs_to_community(target_community_id uuid,target_scope_type text,target_scope_id uuid) returns boolean language sql stable security definer set search_path=public as $$
  select case target_scope_type
    when 'category' then exists(select 1 from public.channel_categories where id=target_scope_id and community_id=target_community_id)
    when 'channel' then exists(select 1 from public.channels where id=target_scope_id and community_id=target_community_id)
    when 'radio_program' then exists(select 1 from public.radio_programs where id=target_scope_id and community_id=target_community_id)
    when 'podcast_series' then exists(select 1 from public.podcast_series where id=target_scope_id and community_id=target_community_id)
    else false end;
$$;

create or replace function public.validate_community_permission_override() returns trigger language plpgsql set search_path=public as $$
declare role_community uuid; community_kind text;
begin
  select community_id into role_community from public.roles where id=new.role_id;
  select kind::text into community_kind from public.communities where id=new.community_id;
  if role_community is distinct from new.community_id then raise exception 'ROLE_COMMUNITY_MISMATCH' using errcode='23514'; end if;
  if not exists(select 1 from public.community_permission_definitions where permission_key=new.permission_key and community_kind=any(allowed_kinds)) then raise exception 'PERMISSION_KIND_MISMATCH' using errcode='23514'; end if;
  if not public.permission_scope_belongs_to_community(new.community_id,new.scope_type,new.scope_id) then raise exception 'PERMISSION_SCOPE_MISMATCH' using errcode='23514'; end if;
  if new.scope_type='radio_program' and not public.community_has_kind(new.community_id,'radio'::public.community_kind) then raise exception 'PERMISSION_KIND_MISMATCH' using errcode='23514'; end if;
  if new.scope_type='podcast_series' and not public.community_has_kind(new.community_id,'podcast'::public.community_kind) then raise exception 'PERMISSION_KIND_MISMATCH' using errcode='23514'; end if;
  return new;
end; $$;

drop trigger if exists community_permission_override_scope on public.community_permission_overrides;
create trigger community_permission_override_scope before insert or update on public.community_permission_overrides for each row execute function public.validate_community_permission_override();

create or replace function public.cleanup_community_permission_overrides() returns trigger language plpgsql security definer set search_path=public as $$ begin delete from public.community_permission_overrides where scope_type=tg_argv[0] and scope_id=old.id; return old; end; $$;
drop trigger if exists category_permission_override_cleanup on public.channel_categories;
create trigger category_permission_override_cleanup after delete on public.channel_categories for each row execute function public.cleanup_community_permission_overrides('category');
drop trigger if exists channel_permission_override_cleanup on public.channels;
create trigger channel_permission_override_cleanup after delete on public.channels for each row execute function public.cleanup_community_permission_overrides('channel');
drop trigger if exists radio_program_permission_override_cleanup on public.radio_programs;
create trigger radio_program_permission_override_cleanup after delete on public.radio_programs for each row execute function public.cleanup_community_permission_overrides('radio_program');
drop trigger if exists podcast_series_permission_override_cleanup on public.podcast_series;
create trigger podcast_series_permission_override_cleanup after delete on public.podcast_series for each row execute function public.cleanup_community_permission_overrides('podcast_series');

create or replace function public.sync_role_permission_json() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then update public.roles set permissions=permissions-old.permission_key,permissions_version=2,updated_at=now() where id=old.role_id; return old; end if;
  update public.roles set permissions=jsonb_set(coalesce(permissions,'{}'::jsonb),array[new.permission_key],to_jsonb(new.allowed),true),permissions_version=2,updated_at=now() where id=new.role_id;
  return new;
end; $$;
drop trigger if exists sync_role_permission_json on public.community_role_permissions;
create trigger sync_role_permission_json after insert or update or delete on public.community_role_permissions for each row execute function public.sync_role_permission_json();

create or replace function public.sync_role_permissions_from_json() returns trigger language plpgsql security definer set search_path=public as $$
declare community_kind text;
begin
  if pg_trigger_depth()>1 then return new; end if;
  select kind::text into community_kind from public.communities where id=new.community_id;
  delete from public.community_role_permissions where role_id=new.id;
  insert into public.community_role_permissions(community_id,role_id,permission_key,allowed)
    select new.community_id,new.id,entry.key,(entry.value)::boolean from jsonb_each_text(coalesce(new.permissions,'{}'::jsonb)) entry join public.community_permission_definitions definition on definition.permission_key=entry.key and community_kind=any(definition.allowed_kinds) where entry.value in ('true','false') on conflict(role_id,permission_key) do update set allowed=excluded.allowed,updated_at=now();
  insert into public.community_role_permissions(community_id,role_id,permission_key,allowed)
    select new.community_id,new.id,permission_key,true from unnest(public.builtin_role_permission_keys(community_kind,new.system_key)) permission_key on conflict(role_id,permission_key) do nothing;
  update public.roles role set permissions=coalesce((select jsonb_object_agg(permission_key,allowed order by permission_key) from public.community_role_permissions where role_id=new.id),'{}'::jsonb),permissions_version=2 where role.id=new.id;
  return new;
end; $$;
drop trigger if exists sync_role_permissions_from_json on public.roles;
create trigger sync_role_permissions_from_json after insert or update of permissions on public.roles for each row execute function public.sync_role_permissions_from_json();

create or replace function public.enforce_community_member_role_integrity() returns trigger language plpgsql security definer set search_path=public as $$
declare target_role public.roles%rowtype; community_owner uuid;
begin
  select owner_id into community_owner from public.communities where id=new.community_id;
  if new.role_id is null then select * into target_role from public.roles where community_id=new.community_id and is_default limit 1; new.role_id:=target_role.id; else select * into target_role from public.roles where id=new.role_id; end if;
  if target_role.id is null or target_role.community_id<>new.community_id then raise exception 'ROLE_COMMUNITY_MISMATCH' using errcode='23514'; end if;
  if target_role.system_key='owner' and new.user_id<>community_owner then raise exception 'OWNER_ROLE_ASSIGNMENT_FORBIDDEN' using errcode='42501'; end if;
  if new.user_id=community_owner and target_role.system_key<>'owner' then raise exception 'OWNER_MEMBERSHIP_ROLE_REQUIRED' using errcode='23514'; end if;
  if tg_op='INSERT' and auth.uid()=new.user_id and new.user_id<>community_owner and not target_role.is_default then raise exception 'ROLE_SELF_ASSIGNMENT_FORBIDDEN' using errcode='42501'; end if;
  return new;
end; $$;
drop trigger if exists community_member_role_integrity on public.community_members;
create trigger community_member_role_integrity before insert or update of community_id,user_id,role_id on public.community_members for each row execute function public.enforce_community_member_role_integrity();

create or replace function public.effective_community_permission(target_community_id uuid,target_permission text,target_scope_type text default null,target_scope_id uuid default null) returns boolean language plpgsql stable security definer set search_path=public as $$
declare community_kind text; community_owner uuid; member_role public.roles%rowtype; result boolean:=false; category_scope uuid; explicit_effect text;
begin
  select kind::text,owner_id into community_kind,community_owner from public.communities where id=target_community_id;
  if community_kind is null or auth.uid() is null then return false; end if;
  if not exists(select 1 from public.community_permission_definitions where permission_key=target_permission and community_kind=any(allowed_kinds)) then return false; end if;
  if target_scope_type is not null and (target_scope_id is null or not public.permission_scope_belongs_to_community(target_community_id,target_scope_type,target_scope_id)) then return false; end if;
  if community_owner=auth.uid() then return true; end if;
  select role.* into member_role from public.community_members member join public.roles role on role.id=member.role_id and role.community_id=member.community_id where member.community_id=target_community_id and member.user_id=auth.uid();
  if member_role.id is null then return false; end if;
  select allowed into result from public.community_role_permissions where role_id=member_role.id and permission_key=target_permission;
  if not found then result:=case when jsonb_typeof(member_role.permissions->target_permission)='boolean' then (member_role.permissions->>target_permission)::boolean else false end; end if;
  if target_scope_type='channel' then
    select category_id into category_scope from public.channels where id=target_scope_id and community_id=target_community_id;
    if category_scope is not null then select effect into explicit_effect from public.community_permission_overrides where role_id=member_role.id and scope_type='category' and scope_id=category_scope and permission_key=target_permission; if found then result:=explicit_effect='allow'; end if; end if;
  end if;
  if target_scope_type is not null then select effect into explicit_effect from public.community_permission_overrides where role_id=member_role.id and scope_type=target_scope_type and scope_id=target_scope_id and permission_key=target_permission; if found then result:=explicit_effect='allow'; end if; end if;
  return coalesce(result,false);
end; $$;

create or replace function public.has_community_permission(target_community_id uuid,target_permission text) returns boolean language sql stable security definer set search_path=public as $$ select public.effective_community_permission(target_community_id,target_permission,null,null); $$;

create or replace function public.can_manage_community_kind(target_community_id uuid,expected_kind public.community_kind,capability text) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.communities where id=target_community_id and kind=expected_kind) and public.has_community_permission(target_community_id,capability);
$$;

create or replace function public.set_community_role_permission(target_community_id uuid,target_role_id uuid,target_permission text,target_allowed boolean,change_reason text) returns void language plpgsql security definer set search_path=public as $$
declare community_owner uuid; community_kind text; actor_role public.roles%rowtype; target_role public.roles%rowtype; definition public.community_permission_definitions%rowtype; actor_position integer;
begin
  if auth.uid() is null then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if;
  if char_length(btrim(change_reason)) not between 10 and 300 then raise exception 'ROLE_PERMISSION_REASON_INVALID' using errcode='22023'; end if;
  select owner_id,kind::text into community_owner,community_kind from public.communities where id=target_community_id;
  select role.* into actor_role from public.community_members member join public.roles role on role.id=member.role_id where member.community_id=target_community_id and member.user_id=auth.uid();
  select * into target_role from public.roles where id=target_role_id and community_id=target_community_id for update;
  select * into definition from public.community_permission_definitions where permission_key=target_permission and community_kind=any(allowed_kinds);
  actor_position:=case when community_owner=auth.uid() then 101 else coalesce(actor_role.level,0) end;
  if target_role.id is null or definition.permission_key is null then raise exception 'ROLE_PERMISSION_INVALID' using errcode='22023'; end if;
  if target_role.system_key='owner' then raise exception 'OWNER_ROLE_MUTATION_FORBIDDEN' using errcode='42501'; end if;
  if community_owner<>auth.uid() and (not public.has_community_permission(target_community_id,'manageRoles') or actor_position<=target_role.level) then raise exception 'ROLE_HIERARCHY_DENIED' using errcode='42501'; end if;
  if target_allowed and community_owner<>auth.uid() and (not definition.delegable or not public.has_community_permission(target_community_id,target_permission)) then raise exception 'PERMISSION_DELEGATION_DENIED' using errcode='42501'; end if;
  insert into public.community_role_permissions(community_id,role_id,permission_key,allowed,created_by) values(target_community_id,target_role_id,target_permission,target_allowed,auth.uid()) on conflict(role_id,permission_key) do update set allowed=excluded.allowed,created_by=excluded.created_by,updated_at=now();
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason) values(target_community_id,auth.uid(),'role_change','role_permission',target_role_id,public.redact_audit_reason(change_reason));
end; $$;

create or replace function public.set_community_permission_override(target_community_id uuid,target_role_id uuid,target_scope_type text,target_scope_id uuid,target_permission text,target_effect text,change_reason text) returns void language plpgsql security definer set search_path=public as $$
declare community_owner uuid; actor_role public.roles%rowtype; target_role public.roles%rowtype; actor_position integer;
begin
  if auth.uid() is null then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if;
  if target_effect not in ('inherit','allow','deny') or char_length(btrim(change_reason)) not between 10 and 300 then raise exception 'PERMISSION_OVERRIDE_INVALID' using errcode='22023'; end if;
  if not public.permission_scope_belongs_to_community(target_community_id,target_scope_type,target_scope_id) then raise exception 'PERMISSION_SCOPE_MISMATCH' using errcode='23514'; end if;
  select owner_id into community_owner from public.communities where id=target_community_id;
  select role.* into actor_role from public.community_members member join public.roles role on role.id=member.role_id where member.community_id=target_community_id and member.user_id=auth.uid();
  select * into target_role from public.roles where id=target_role_id and community_id=target_community_id for update;
  actor_position:=case when community_owner=auth.uid() then 101 else coalesce(actor_role.level,0) end;
  if target_role.id is null or target_role.system_key='owner' then raise exception 'OWNER_ROLE_MUTATION_FORBIDDEN' using errcode='42501'; end if;
  if community_owner<>auth.uid() and (not public.has_community_permission(target_community_id,'managePermissionOverrides') or actor_position<=target_role.level) then raise exception 'ROLE_HIERARCHY_DENIED' using errcode='42501'; end if;
  if target_effect='allow' and community_owner<>auth.uid() and not public.effective_community_permission(target_community_id,target_permission,target_scope_type,target_scope_id) then raise exception 'PERMISSION_DELEGATION_DENIED' using errcode='42501'; end if;
  if target_effect='inherit' then delete from public.community_permission_overrides where role_id=target_role_id and scope_type=target_scope_type and scope_id=target_scope_id and permission_key=target_permission;
  else insert into public.community_permission_overrides(community_id,role_id,scope_type,scope_id,permission_key,effect,created_by) values(target_community_id,target_role_id,target_scope_type,target_scope_id,target_permission,target_effect,auth.uid()) on conflict(role_id,scope_type,scope_id,permission_key) do update set effect=excluded.effect,created_by=excluded.created_by,updated_at=now(); end if;
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason) values(target_community_id,auth.uid(),'role_change','permission_override',target_scope_id,public.redact_audit_reason(change_reason));
end; $$;

create or replace function public.assign_community_member_role(target_community_id uuid,target_member_id uuid,target_role_id uuid,change_reason text default 'Role assigned in community admin panel') returns table(id uuid,community_id uuid,user_id uuid,role_id uuid,joined_at timestamptz) language plpgsql security definer set search_path=public as $$
declare community_record public.communities%rowtype; actor_role public.roles%rowtype; target_membership public.community_members%rowtype; current_target_role public.roles%rowtype; next_role public.roles%rowtype; actor_position integer;
begin
  if auth.uid() is null then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if;
  if char_length(btrim(change_reason))<10 or char_length(change_reason)>300 then raise exception 'ROLE_ASSIGNMENT_INVALID' using errcode='22023'; end if;
  select * into community_record from public.communities where id=target_community_id;
  select role.* into actor_role from public.community_members member join public.roles role on role.id=member.role_id where member.community_id=target_community_id and member.user_id=auth.uid();
  select * into target_membership from public.community_members where id=target_member_id and community_id=target_community_id for update;
  select * into current_target_role from public.roles where id=target_membership.role_id and community_id=target_community_id;
  select * into next_role from public.roles where id=target_role_id and community_id=target_community_id;
  actor_position:=case when community_record.owner_id=auth.uid() then 101 else coalesce(actor_role.level,0) end;
  if community_record.id is null or target_membership.id is null or current_target_role.id is null or next_role.id is null then raise exception 'ROLE_ASSIGNMENT_INVALID' using errcode='22023'; end if;
  if target_membership.user_id=community_record.owner_id or current_target_role.system_key='owner' or next_role.system_key='owner' or next_role.level>=100 then raise exception 'OWNER_ROLE_TRANSFER_REQUIRED' using errcode='42501'; end if;
  if community_record.owner_id<>auth.uid() and (not public.has_community_permission(target_community_id,'manageRoles') or current_target_role.level>=actor_position or next_role.level>=actor_position) then raise exception 'ROLE_HIERARCHY_DENIED' using errcode='42501'; end if;
  if target_membership.role_id<>next_role.id then update public.community_members set role_id=next_role.id where community_members.id=target_membership.id returning * into target_membership; insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason) values(target_community_id,auth.uid(),'role_change','member',target_membership.id,public.redact_audit_reason('Role changed from '||current_target_role.name||' to '||next_role.name||': '||change_reason)); end if;
  return query select target_membership.id,target_membership.community_id,target_membership.user_id,target_membership.role_id,target_membership.joined_at;
end; $$;

alter table public.community_permission_definitions enable row level security;
alter table public.community_role_permissions enable row level security;
alter table public.community_permission_overrides enable row level security;
revoke all on public.community_permission_definitions,public.community_role_permissions,public.community_permission_overrides from anon,authenticated;
grant select on public.community_permission_definitions to authenticated;
grant select on public.community_role_permissions,public.community_permission_overrides to authenticated;
create policy permission_definitions_authenticated_read on public.community_permission_definitions for select to authenticated using(true);
create policy role_permissions_manager_read on public.community_role_permissions for select to authenticated using(public.is_community_owner(community_id) or public.has_community_permission(community_id,'manageRoles'));
create policy permission_overrides_manager_read on public.community_permission_overrides for select to authenticated using(public.is_community_owner(community_id) or public.has_community_permission(community_id,'managePermissionOverrides'));

revoke insert,update,delete on public.roles from authenticated;
revoke all on function public.builtin_role_permission_keys(text,text),public.permission_scope_belongs_to_community(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.effective_community_permission(uuid,text,text,uuid),public.has_community_permission(uuid,text),public.set_community_role_permission(uuid,uuid,text,boolean,text),public.set_community_permission_override(uuid,uuid,text,uuid,text,text,text),public.assign_community_member_role(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.effective_community_permission(uuid,text,text,uuid),public.has_community_permission(uuid,text),public.set_community_role_permission(uuid,uuid,text,boolean,text),public.set_community_permission_override(uuid,uuid,text,uuid,text,text,text),public.assign_community_member_role(uuid,uuid,uuid,text) to authenticated;

comment on table public.community_permission_definitions is 'Canonical versioned Picom community permission registry.';
comment on table public.community_role_permissions is 'Canonical normalized role grants; roles.permissions remains a compatibility projection.';
comment on table public.community_permission_overrides is 'Role overrides for approved category, channel, Radio program, and Podcast series scopes.';
comment on function public.effective_community_permission(uuid,text,text,uuid) is 'Deny-by-default permission evaluator. Owner invariant applies only after community and resource scope validation.';
commit;
