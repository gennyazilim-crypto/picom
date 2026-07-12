-- Task 493: audited role create, edit, display ordering, duplicate support, and safe delete RPCs.
begin;
alter table public.roles add column if not exists icon text;
alter table public.roles add column if not exists display_order integer not null default 0;
update public.roles set display_order=level*100 where display_order=0;
do $$ begin if not exists(select 1 from pg_constraint where conname='roles_icon_key_check') then alter table public.roles add constraint roles_icon_key_check check(icon is null or (char_length(icon) between 1 and 32 and icon ~ '^[a-z][a-z0-9-]*$')); end if; end $$;
create index if not exists roles_community_display_order on public.roles(community_id,display_order desc,level desc);

create or replace function public.validate_role_permission_payload(target_community_id uuid,target_permissions jsonb,target_actor_is_owner boolean) returns void language plpgsql stable security definer set search_path=public as $$
declare community_kind text; entry record;
begin
  if jsonb_typeof(target_permissions)<>'object' then raise exception 'ROLE_PERMISSIONS_INVALID' using errcode='22023'; end if;
  select kind::text into community_kind from public.communities where id=target_community_id;
  for entry in select key,value from jsonb_each(target_permissions) loop
    if jsonb_typeof(entry.value)<>'boolean' or not exists(select 1 from public.community_permission_definitions where permission_key=entry.key and community_kind=any(allowed_kinds)) then raise exception 'ROLE_PERMISSIONS_INVALID' using errcode='22023'; end if;
    if entry.value='true'::jsonb and not target_actor_is_owner and not public.has_community_permission(target_community_id,entry.key) then raise exception 'PERMISSION_DELEGATION_DENIED' using errcode='42501'; end if;
  end loop;
end; $$;

create or replace function public.create_community_role(target_community_id uuid,target_name text,target_color text,target_icon text,target_level integer,target_permissions jsonb,change_reason text) returns setof public.roles language plpgsql security definer set search_path=public as $$
declare owner_id uuid; actor_role public.roles%rowtype; actor_position integer; created_role public.roles%rowtype;
begin
  if auth.uid() is null or char_length(btrim(change_reason)) not between 10 and 300 then raise exception 'ROLE_CREATE_INVALID' using errcode='22023'; end if;
  select community.owner_id into owner_id from public.communities community where community.id=target_community_id;
  select role.* into actor_role from public.community_members member join public.roles role on role.id=member.role_id where member.community_id=target_community_id and member.user_id=auth.uid();
  actor_position:=case when owner_id=auth.uid() then 101 else coalesce(actor_role.level,0) end;
  if owner_id<>auth.uid() and not public.has_community_permission(target_community_id,'manageRoles') then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if;
  if target_level not between 0 and 99 or target_level>=actor_position then raise exception 'ROLE_HIERARCHY_DENIED' using errcode='42501'; end if;
  if char_length(btrim(target_name)) not between 1 and 40 or lower(btrim(target_name)) in ('owner','admin','moderator','member') or target_color!~'^#[0-9A-Fa-f]{6}$' then raise exception 'ROLE_CREATE_INVALID' using errcode='22023'; end if;
  perform public.validate_role_permission_payload(target_community_id,target_permissions,owner_id=auth.uid());
  insert into public.roles(community_id,name,color,icon,level,display_order,permissions,system_key,is_default,permissions_version) values(target_community_id,btrim(target_name),target_color,nullif(target_icon,''),target_level,coalesce((select max(display_order)+100 from public.roles where community_id=target_community_id),100),target_permissions,null,false,2) returning * into created_role;
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason) values(target_community_id,auth.uid(),'role_change','role',created_role.id,public.redact_audit_reason(change_reason));
  return next created_role;
end; $$;

create or replace function public.update_community_role(target_community_id uuid,target_role_id uuid,target_name text,target_color text,target_icon text,target_level integer,target_permissions jsonb,change_reason text) returns setof public.roles language plpgsql security definer set search_path=public as $$
declare owner_id uuid; actor_role public.roles%rowtype; role_record public.roles%rowtype; actor_position integer;
begin
  if auth.uid() is null or char_length(btrim(change_reason)) not between 10 and 300 then raise exception 'ROLE_UPDATE_INVALID' using errcode='22023'; end if;
  select community.owner_id into owner_id from public.communities community where community.id=target_community_id;
  select role.* into actor_role from public.community_members member join public.roles role on role.id=member.role_id where member.community_id=target_community_id and member.user_id=auth.uid();
  select * into role_record from public.roles where id=target_role_id and community_id=target_community_id for update;
  actor_position:=case when owner_id=auth.uid() then 101 else coalesce(actor_role.level,0) end;
  if role_record.id is null then raise exception 'ROLE_UPDATE_INVALID' using errcode='22023'; end if;
  if role_record.system_key='owner' then raise exception 'SYSTEM_ROLE_MUTATION_FORBIDDEN' using errcode='42501'; end if;
  if owner_id<>auth.uid() and (not public.has_community_permission(target_community_id,'manageRoles') or role_record.level>=actor_position) then raise exception 'ROLE_HIERARCHY_DENIED' using errcode='42501'; end if;
  if target_level not between 0 and 99 or target_level>=actor_position or char_length(btrim(target_name)) not between 1 and 40 or target_color!~'^#[0-9A-Fa-f]{6}$' then raise exception 'ROLE_UPDATE_INVALID' using errcode='22023'; end if;
  if role_record.system_key is not null and lower(btrim(target_name))<>lower(role_record.name) then raise exception 'SYSTEM_ROLE_MUTATION_FORBIDDEN' using errcode='42501'; end if;
  perform public.validate_role_permission_payload(target_community_id,target_permissions,owner_id=auth.uid());
  update public.roles set name=btrim(target_name),color=target_color,icon=nullif(target_icon,''),level=target_level,permissions=target_permissions,permissions_version=2,updated_at=now() where id=role_record.id returning * into role_record;
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason) values(target_community_id,auth.uid(),'role_change','role',role_record.id,public.redact_audit_reason(change_reason));
  return next role_record;
end; $$;

create or replace function public.swap_community_role_order(target_community_id uuid,target_role_id uuid,adjacent_role_id uuid,change_reason text) returns setof public.roles language plpgsql security definer set search_path=public as $$
declare owner_id uuid; actor_role public.roles%rowtype; first_role public.roles%rowtype; second_role public.roles%rowtype; actor_position integer; first_order integer;
begin
  if target_role_id=adjacent_role_id or char_length(btrim(change_reason)) not between 10 and 300 then raise exception 'ROLE_ORDER_INVALID' using errcode='22023'; end if;
  select community.owner_id into owner_id from public.communities community where community.id=target_community_id;
  select role.* into actor_role from public.community_members member join public.roles role on role.id=member.role_id where member.community_id=target_community_id and member.user_id=auth.uid();
  select * into first_role from public.roles where id=target_role_id and community_id=target_community_id for update;
  select * into second_role from public.roles where id=adjacent_role_id and community_id=target_community_id for update;
  actor_position:=case when owner_id=auth.uid() then 101 else coalesce(actor_role.level,0) end;
  if first_role.id is null or second_role.id is null or first_role.system_key='owner' or second_role.system_key='owner' then raise exception 'ROLE_ORDER_INVALID' using errcode='22023'; end if;
  if owner_id<>auth.uid() and (not public.has_community_permission(target_community_id,'manageRoles') or first_role.level>=actor_position or second_role.level>=actor_position) then raise exception 'ROLE_HIERARCHY_DENIED' using errcode='42501'; end if;
  first_order:=first_role.display_order; update public.roles set display_order=second_role.display_order,updated_at=now() where id=first_role.id; update public.roles set display_order=first_order,updated_at=now() where id=second_role.id;
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason) values(target_community_id,auth.uid(),'role_change','role_order',first_role.id,public.redact_audit_reason(change_reason));
  return query select role.* from public.roles role where role.id in(first_role.id,second_role.id);
end; $$;

create or replace function public.delete_community_role(target_community_id uuid,target_role_id uuid,change_reason text) returns boolean language plpgsql security definer set search_path=public as $$
declare owner_id uuid; actor_role public.roles%rowtype; target_role public.roles%rowtype; actor_position integer;
begin
  if auth.uid() is null or char_length(btrim(change_reason)) not between 10 and 300 then raise exception 'ROLE_DELETE_INVALID' using errcode='22023'; end if;
  select community.owner_id into owner_id from public.communities community where community.id=target_community_id;
  select role.* into actor_role from public.community_members member join public.roles role on role.id=member.role_id where member.community_id=target_community_id and member.user_id=auth.uid();
  select * into target_role from public.roles where id=target_role_id and community_id=target_community_id for update;
  actor_position:=case when owner_id=auth.uid() then 101 else coalesce(actor_role.level,0) end;
  if target_role.id is null or target_role.system_key is not null or target_role.is_default then raise exception 'SYSTEM_ROLE_MUTATION_FORBIDDEN' using errcode='42501'; end if;
  if exists(select 1 from public.community_members where role_id=target_role.id) then raise exception 'ROLE_IN_USE' using errcode='23503'; end if;
  if owner_id<>auth.uid() and (not public.has_community_permission(target_community_id,'manageRoles') or target_role.level>=actor_position) then raise exception 'ROLE_HIERARCHY_DENIED' using errcode='42501'; end if;
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason) values(target_community_id,auth.uid(),'role_change','role',target_role.id,public.redact_audit_reason(change_reason)); delete from public.roles where id=target_role.id; return true;
end; $$;

revoke all on function public.validate_role_permission_payload(uuid,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.create_community_role(uuid,text,text,text,integer,jsonb,text),public.update_community_role(uuid,uuid,text,text,text,integer,jsonb,text),public.swap_community_role_order(uuid,uuid,uuid,text),public.delete_community_role(uuid,uuid,text) from public,anon;
grant execute on function public.create_community_role(uuid,text,text,text,integer,jsonb,text),public.update_community_role(uuid,uuid,text,text,text,integer,jsonb,text),public.swap_community_role_order(uuid,uuid,uuid,text),public.delete_community_role(uuid,uuid,text) to authenticated;
comment on function public.create_community_role(uuid,text,text,text,integer,jsonb,text) is 'Creates an audited custom role strictly below the actor and validates every permission against the canonical registry.';
commit;
