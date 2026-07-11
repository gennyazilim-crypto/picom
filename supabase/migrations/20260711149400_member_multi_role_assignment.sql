-- Task 494: atomic multi-role assignment, hierarchy safeguards, realtime projection, and append-only audit.
begin;
create table if not exists public.community_member_roles (
  id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities(id) on delete cascade,
  member_id uuid not null references public.community_members(id) on delete cascade, role_id uuid not null references public.roles(id) on delete cascade,
  is_primary boolean not null default false, assigned_by uuid references public.profiles(id) on delete set null, assigned_at timestamptz not null default now(), unique(member_id,role_id)
);
create unique index if not exists community_member_roles_one_primary on public.community_member_roles(member_id) where is_primary;
create index if not exists community_member_roles_community_member on public.community_member_roles(community_id,member_id);
create index if not exists community_member_roles_role on public.community_member_roles(role_id,member_id);

create table if not exists public.community_member_role_audit (
  id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities(id) on delete restrict,
  member_id uuid not null, target_user_id uuid not null, actor_id uuid not null references public.profiles(id) on delete restrict,
  old_role_ids uuid[] not null, new_role_ids uuid[] not null, reason text not null check(char_length(reason) between 10 and 500), created_at timestamptz not null default now()
);
create index if not exists community_member_role_audit_community_created on public.community_member_role_audit(community_id,created_at desc);
create index if not exists community_member_role_audit_target on public.community_member_role_audit(community_id,target_user_id,created_at desc);

create or replace function public.validate_community_member_role_link() returns trigger language plpgsql security definer set search_path=public as $$
declare member_community uuid; member_user uuid; role_community uuid; role_system_key text; community_owner uuid;
begin
  select community_id,user_id into member_community,member_user from public.community_members where id=new.member_id;
  select community_id,system_key into role_community,role_system_key from public.roles where id=new.role_id;
  select owner_id into community_owner from public.communities where id=new.community_id;
  if member_community is distinct from new.community_id or role_community is distinct from new.community_id then raise exception 'ROLE_COMMUNITY_MISMATCH' using errcode='23514'; end if;
  if role_system_key='owner' and member_user<>community_owner then raise exception 'OWNER_ROLE_ASSIGNMENT_FORBIDDEN' using errcode='42501'; end if;
  return new;
end; $$;
drop trigger if exists community_member_role_link_integrity on public.community_member_roles;
create trigger community_member_role_link_integrity before insert or update on public.community_member_roles for each row execute function public.validate_community_member_role_link();

insert into public.community_member_roles(community_id,member_id,role_id,is_primary)
select community_id,id,role_id,true from public.community_members where role_id is not null on conflict(member_id,role_id) do update set is_primary=true;

create or replace function public.sync_primary_community_member_role() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.role_id is null then return new; end if;
  update public.community_member_roles set is_primary=false where member_id=new.id and role_id<>new.role_id and is_primary;
  insert into public.community_member_roles(community_id,member_id,role_id,is_primary,assigned_by) values(new.community_id,new.id,new.role_id,true,auth.uid()) on conflict(member_id,role_id) do update set is_primary=true;
  return new;
end; $$;
drop trigger if exists sync_primary_community_member_role on public.community_members;
create trigger sync_primary_community_member_role after insert or update of role_id on public.community_members for each row execute function public.sync_primary_community_member_role();

create or replace function public.prevent_assigned_community_role_delete() returns trigger language plpgsql security definer set search_path=public as $$ begin if exists(select 1 from public.community_member_roles where role_id=old.id) and exists(select 1 from public.communities where id=old.community_id) then raise exception 'ROLE_IN_USE' using errcode='23503'; end if; return old; end; $$;
drop trigger if exists prevent_assigned_community_role_delete on public.roles;
create trigger prevent_assigned_community_role_delete before delete on public.roles for each row execute function public.prevent_assigned_community_role_delete();

create or replace function public.effective_community_permission(target_community_id uuid,target_permission text,target_scope_type text default null,target_scope_id uuid default null) returns boolean language plpgsql stable security definer set search_path=public as $$
declare community_kind text; community_owner uuid; target_member_id uuid; primary_role_id uuid; member_role_ids uuid[]; result boolean:=false; category_scope uuid; explicit_effect text;
begin
  select kind::text,owner_id into community_kind,community_owner from public.communities where id=target_community_id;
  if community_kind is null or auth.uid() is null then return false; end if;
  if not exists(select 1 from public.community_permission_definitions where permission_key=target_permission and community_kind=any(allowed_kinds)) then return false; end if;
  if target_scope_type is not null and (target_scope_id is null or not public.permission_scope_belongs_to_community(target_community_id,target_scope_type,target_scope_id)) then return false; end if;
  if community_owner=auth.uid() then return true; end if;
  select id,role_id into target_member_id,primary_role_id from public.community_members where community_id=target_community_id and user_id=auth.uid();
  if target_member_id is null then return false; end if;
  select array_agg(role_id) into member_role_ids from public.community_member_roles where member_id=target_member_id;
  if coalesce(cardinality(member_role_ids),0)=0 and primary_role_id is not null then member_role_ids:=array[primary_role_id]; end if;
  select coalesce(bool_or(coalesce(permission.allowed,case when jsonb_typeof(role.permissions->target_permission)='boolean' then (role.permissions->>target_permission)::boolean else false end)),false) into result from public.roles role left join public.community_role_permissions permission on permission.role_id=role.id and permission.permission_key=target_permission where role.id=any(member_role_ids);
  if target_scope_type='channel' then select category_id into category_scope from public.channels where id=target_scope_id and community_id=target_community_id; if category_scope is not null then select case when bool_or(effect='deny') then 'deny' when bool_or(effect='allow') then 'allow' end into explicit_effect from public.community_permission_overrides where role_id=any(member_role_ids) and scope_type='category' and scope_id=category_scope and permission_key=target_permission; if explicit_effect is not null then result:=explicit_effect='allow'; end if; end if; end if;
  if target_scope_type is not null then select case when bool_or(effect='deny') then 'deny' when bool_or(effect='allow') then 'allow' end into explicit_effect from public.community_permission_overrides where role_id=any(member_role_ids) and scope_type=target_scope_type and scope_id=target_scope_id and permission_key=target_permission; if explicit_effect is not null then result:=explicit_effect='allow'; end if; end if;
  return coalesce(result,false);
end; $$;

create or replace function public.set_community_member_roles(target_community_id uuid,target_member_id uuid,target_role_ids uuid[],change_reason text) returns table(member_id uuid,community_id uuid,user_id uuid,primary_role_id uuid,role_ids uuid[]) language plpgsql security definer set search_path=public as $$
declare community_owner uuid; target_member public.community_members%rowtype; actor_position integer; target_position integer; requested_position integer; requested_count integer; old_roles uuid[]; primary_role uuid;
begin
  if auth.uid() is null or coalesce(cardinality(target_role_ids),0)=0 or char_length(btrim(change_reason)) not between 10 and 300 then raise exception 'ROLE_ASSIGNMENT_INVALID' using errcode='22023'; end if;
  select owner_id into community_owner from public.communities where id=target_community_id;
  select * into target_member from public.community_members where id=target_member_id and community_id=target_community_id for update;
  if target_member.id is null or exists(select 1 from public.community_bans where community_id=target_community_id and user_id=target_member.user_id and revoked_at is null) then raise exception 'MEMBER_UNAVAILABLE' using errcode='22023'; end if;
  if target_member.user_id=community_owner then raise exception 'OWNER_ROLE_TRANSFER_REQUIRED' using errcode='42501'; end if;
  if target_member.user_id=auth.uid() then raise exception 'SELF_ROLE_CHANGE_FORBIDDEN' using errcode='42501'; end if;
  select count(distinct role.id),max(role.level) into requested_count,requested_position from public.roles role where role.community_id=target_community_id and role.id=any(target_role_ids);
  if requested_count<>cardinality(target_role_ids) or exists(select 1 from public.roles where id=any(target_role_ids) and system_key='owner') then raise exception 'ROLE_ASSIGNMENT_INVALID' using errcode='22023'; end if;
  select coalesce(array_agg(role_id order by role_id),array[]::uuid[]) into old_roles from public.community_member_roles where member_id=target_member.id;
  select coalesce(max(role.level),0) into target_position from public.community_member_roles link join public.roles role on role.id=link.role_id where link.member_id=target_member.id;
  if community_owner=auth.uid() then actor_position:=101; else select coalesce(max(role.level),0) into actor_position from public.community_members actor join public.community_member_roles link on link.member_id=actor.id join public.roles role on role.id=link.role_id where actor.community_id=target_community_id and actor.user_id=auth.uid(); end if;
  if community_owner<>auth.uid() and (not public.has_community_permission(target_community_id,'manageRoles') or target_position>=actor_position or requested_position>=actor_position) then raise exception 'ROLE_HIERARCHY_DENIED' using errcode='42501'; end if;
  if community_owner<>auth.uid() and exists(select 1 from public.community_role_permissions permission where permission.role_id=any(target_role_ids) and permission.allowed and not public.has_community_permission(target_community_id,permission.permission_key)) then raise exception 'PERMISSION_DELEGATION_DENIED' using errcode='42501'; end if;
  select id into primary_role from public.roles where community_id=target_community_id and id=any(target_role_ids) order by level desc,display_order desc,id limit 1;
  delete from public.community_member_roles where community_member_roles.member_id=target_member.id;
  insert into public.community_member_roles(community_id,member_id,role_id,is_primary,assigned_by) select target_community_id,target_member.id,requested_role_id,requested_role_id=primary_role,auth.uid() from unnest(target_role_ids) requested_role_id;
  update public.community_members set role_id=primary_role where id=target_member.id;
  insert into public.community_member_role_audit(community_id,member_id,target_user_id,actor_id,old_role_ids,new_role_ids,reason) values(target_community_id,target_member.id,target_member.user_id,auth.uid(),old_roles,target_role_ids,public.redact_audit_reason(change_reason));
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason) values(target_community_id,auth.uid(),'role_change','member_roles',target_member.id,public.redact_audit_reason('Assigned role set changed: '||change_reason));
  return query select target_member.id,target_member.community_id,target_member.user_id,primary_role,target_role_ids;
end; $$;

create or replace function public.assign_community_member_role(target_community_id uuid,target_member_id uuid,target_role_id uuid,change_reason text default 'Role assigned in community admin panel') returns table(id uuid,community_id uuid,user_id uuid,role_id uuid,joined_at timestamptz) language plpgsql security definer set search_path=public as $$
declare membership public.community_members%rowtype;
begin perform public.set_community_member_roles(target_community_id,target_member_id,array[target_role_id],change_reason); select * into membership from public.community_members where community_members.id=target_member_id; return query select membership.id,membership.community_id,membership.user_id,membership.role_id,membership.joined_at; end; $$;

alter table public.community_member_roles enable row level security;
alter table public.community_member_role_audit enable row level security;
revoke all on public.community_member_roles,public.community_member_role_audit from anon,authenticated;
grant select on public.community_member_roles,public.community_member_role_audit to authenticated;
create policy community_member_roles_member_read on public.community_member_roles for select to authenticated using(public.is_community_member(community_id));
create policy community_member_role_audit_manager_read on public.community_member_role_audit for select to authenticated using(public.has_community_permission(community_id,'viewAuditLog'));
alter table public.community_member_roles replica identity full;
do $$ begin alter publication supabase_realtime add table public.community_member_roles; exception when duplicate_object or undefined_object then null; end $$;
revoke all on function public.set_community_member_roles(uuid,uuid,uuid[],text),public.assign_community_member_role(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.set_community_member_roles(uuid,uuid,uuid[],text),public.assign_community_member_role(uuid,uuid,uuid,text) to authenticated;
comment on table public.community_member_role_audit is 'Append-only actor, target, previous role set, and next role set evidence. Renderer clients cannot mutate it.';
commit;
