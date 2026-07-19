insert into public.roles(community_id, name, color, level, permissions)
select community.id, 'Radio Producer', '#E28A3B', 70,
  '{"viewRadioContent":true,"listenRadio":true,"hostRadio":true,"manageRadioSchedule":true,"manageRadioPrograms":true,"manageRadioHosts":true,"moderateRadioComments":true}'::jsonb
from public.communities community
where community.kind = 'radio'::public.community_kind
on conflict do nothing;

update public.roles role
set permissions = (role.permissions - 'manageRadioSchedule' - 'manageRadioPrograms' - 'manageRadioHosts')
  || '{"viewRadioContent":true,"listenRadio":true,"hostRadio":true}'::jsonb
from public.communities community
where role.community_id = community.id
  and community.kind = 'radio'::public.community_kind
  and lower(role.name) = 'radio host';

update public.roles role
set permissions = role.permissions || '{"manageRadioHosts":true}'::jsonb
from public.communities community
where role.community_id = community.id
  and community.kind = 'radio'::public.community_kind
  and lower(role.name) = 'owner';

create or replace function public.ensure_radio_community_default_template(target_community_id uuid, target_owner_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  target_kind public.community_kind;
  owner_role_id uuid;
begin
  select community.kind into target_kind from public.communities community where community.id = target_community_id and community.owner_id = target_owner_id;
  if target_kind is distinct from 'radio'::public.community_kind then raise exception 'RADIO_TEMPLATE_COMMUNITY_INVALID' using errcode = '23514'; end if;

  insert into public.roles(community_id, name, color, level, permissions) values
    (target_community_id, 'Owner', '#007571', 100, '{"manageCommunity":true,"manageRoles":true,"manageMembers":true,"hostRadio":true,"manageRadioCommunity":true,"manageRadioSchedule":true,"manageRadioPrograms":true,"manageRadioHosts":true,"publishRadioAnnouncements":true,"createInvites":true,"viewAuditLog":true}'::jsonb),
    (target_community_id, 'Radio Producer', '#E28A3B', 70, '{"viewRadioContent":true,"listenRadio":true,"hostRadio":true,"manageRadioSchedule":true,"manageRadioPrograms":true,"manageRadioHosts":true,"moderateRadioComments":true}'::jsonb),
    (target_community_id, 'Radio Host', '#10C2BB', 50, '{"viewRadioContent":true,"listenRadio":true,"hostRadio":true}'::jsonb),
    (target_community_id, 'Member', '#6B7F8C', 10, '{"viewRadioContent":true,"listenRadio":true}'::jsonb)
  on conflict do nothing;

  select role.id into owner_role_id from public.roles role where role.community_id = target_community_id and lower(role.name) = 'owner' order by role.level desc limit 1;
  if owner_role_id is null then raise exception 'RADIO_TEMPLATE_OWNER_ROLE_MISSING' using errcode = '23514'; end if;
  insert into public.community_members(community_id, user_id, role_id) values (target_community_id, target_owner_id, owner_role_id)
  on conflict (community_id, user_id) do update set role_id = excluded.role_id;
  insert into public.radio_community_settings(community_id, schedule_timezone, listener_chat_enabled, listener_chat_channel_id, announcements_enabled)
  values (target_community_id, 'UTC', false, null, true) on conflict (community_id) do nothing;
end
$$;

create or replace function public.radio_host_assignment_rank(target_host_role text)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case target_host_role when 'producer' then 70 when 'host' then 50 when 'co_host' then 40 else 101 end;
$$;

create or replace function public.is_radio_assignment_capable(
  target_community_id uuid,
  target_user_id uuid,
  target_host_role text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.community_members member
    join public.roles role on role.id = member.role_id and role.community_id = member.community_id
    join public.communities community on community.id = member.community_id
    where member.community_id = target_community_id
      and member.user_id = target_user_id
      and (
        community.owner_id = target_user_id
        or role.level >= 80
        or role.permissions ->> 'manageCommunity' = 'true'
        or (
          target_host_role in ('host', 'co_host')
          and role.permissions ->> 'hostRadio' = 'true'
        )
        or (
          target_host_role = 'producer'
          and (
            role.permissions ->> 'manageRadioHosts' = 'true'
            or role.permissions ->> 'manageRadioPrograms' = 'true'
          )
        )
      )
  );
$$;

create or replace function public.can_assign_radio_session_host(
  target_session_id uuid,
  target_user_id uuid,
  target_host_role text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  target_session public.radio_sessions%rowtype;
  target_community public.communities%rowtype;
  actor_role public.roles%rowtype;
  target_role public.roles%rowtype;
  actor_level integer := 0;
  actor_can_assign boolean := false;
begin
  if auth.uid() is null or target_host_role not in ('host', 'co_host', 'producer') then return false; end if;
  select * into target_session from public.radio_sessions session where session.id = target_session_id;
  if target_session.id is null then return false; end if;
  select * into target_community from public.communities community where community.id = target_session.community_id and community.kind = 'radio'::public.community_kind;
  if target_community.id is null then return false; end if;
  select role.* into actor_role
  from public.community_members member join public.roles role on role.id = member.role_id and role.community_id = member.community_id
  where member.community_id = target_community.id and member.user_id = auth.uid();
  select role.* into target_role
  from public.community_members member join public.roles role on role.id = member.role_id and role.community_id = member.community_id
  where member.community_id = target_community.id and member.user_id = target_user_id;
  if target_role.id is null then return false; end if;
  if target_community.owner_id = auth.uid() then return true; end if;
  if actor_role.id is null or target_user_id = auth.uid() or target_community.owner_id = target_user_id then return false; end if;
  actor_level := actor_role.level;
  actor_can_assign := actor_role.level >= 80
    or actor_role.permissions ->> 'manageCommunity' = 'true'
    or actor_role.permissions ->> 'manageRadioCommunity' = 'true'
    or actor_role.permissions ->> 'manageRadioPrograms' = 'true'
    or actor_role.permissions ->> 'manageRadioHosts' = 'true';
  return actor_can_assign
    and target_role.level < actor_level
    and public.radio_host_assignment_rank(target_host_role) < actor_level;
end;
$$;

create or replace function public.can_manage_radio_session(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.radio_sessions session
    join public.communities community on community.id = session.community_id and community.kind = 'radio'::public.community_kind
    where session.id = target_session_id
      and (
        community.owner_id = auth.uid()
        or public.can_manage_community_kind(session.community_id, 'radio'::public.community_kind, 'manageRadioPrograms')
        or public.can_manage_community_kind(session.community_id, 'radio'::public.community_kind, 'manageRadioHosts')
        or (
          (
            session.host_user_id = auth.uid()
            or exists (
              select 1 from public.radio_session_hosts assignment
              where assignment.radio_session_id = session.id
                and assignment.user_id = auth.uid()
                and assignment.host_role in ('host', 'co_host', 'producer')
            )
          )
          and exists (
            select 1
            from public.community_members member
            join public.roles role on role.id = member.role_id and role.community_id = member.community_id
            where member.community_id = session.community_id
              and member.user_id = auth.uid()
              and (
                role.level >= 80
                or role.permissions ->> 'manageCommunity' = 'true'
                or role.permissions ->> 'hostRadio' = 'true'
              )
          )
        )
      )
  );
$$;

create or replace function public.protect_radio_primary_host()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.host_user_id is distinct from old.host_user_id then
    raise exception 'RADIO_PRIMARY_HOST_TRANSFER_REQUIRED' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists radio_primary_host_immutable on public.radio_sessions;
create trigger radio_primary_host_immutable
before update of host_user_id on public.radio_sessions
for each row execute function public.protect_radio_primary_host();

create or replace function public.assign_radio_session_host(
  target_session_id uuid,
  target_user_id uuid,
  target_host_role text default 'co_host'
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare target_session public.radio_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if target_host_role not in ('host', 'co_host', 'producer') then raise exception 'RADIO_HOST_ROLE_INVALID' using errcode = '22023'; end if;
  select * into target_session from public.radio_sessions session where session.id = target_session_id for update;
  if target_session.id is null then raise exception 'RADIO_SESSION_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.can_assign_radio_session_host(target_session_id, target_user_id, target_host_role) then raise exception 'RADIO_HOST_HIERARCHY_DENIED' using errcode = '42501'; end if;
  if not public.is_radio_assignment_capable(target_session.community_id, target_user_id, target_host_role) then raise exception 'RADIO_HOST_COMMON_ROLE_REQUIRED' using errcode = '42501'; end if;

  insert into public.radio_session_hosts(radio_session_id, user_id, host_role, assigned_by)
  values(target_session_id, target_user_id, target_host_role, auth.uid())
  on conflict(radio_session_id, user_id)
  do update set host_role = excluded.host_role, assigned_by = excluded.assigned_by, assigned_at = now();

  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason)
  values(target_session.community_id, auth.uid(), 'role_change', 'radio_host_assignment', target_session.id,
    public.redact_audit_reason('Assigned ' || target_user_id::text || ' as ' || target_host_role));
  return true;
end;
$$;

create or replace function public.remove_radio_session_host(target_session_id uuid, target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_session public.radio_sessions%rowtype;
  target_assignment public.radio_session_hosts%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into target_session from public.radio_sessions session where session.id = target_session_id for update;
  select * into target_assignment from public.radio_session_hosts assignment where assignment.radio_session_id = target_session_id and assignment.user_id = target_user_id for update;
  if target_session.id is null or target_assignment.id is null then raise exception 'RADIO_HOST_ASSIGNMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if target_session.host_user_id = target_user_id then raise exception 'RADIO_PRIMARY_HOST_TRANSFER_REQUIRED' using errcode = '42501'; end if;
  if not public.can_assign_radio_session_host(target_session_id, target_user_id, target_assignment.host_role) then raise exception 'RADIO_HOST_HIERARCHY_DENIED' using errcode = '42501'; end if;

  delete from public.radio_session_hosts assignment where assignment.id = target_assignment.id;
  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason)
  values(target_session.community_id, auth.uid(), 'role_change', 'radio_host_removal', target_session.id,
    public.redact_audit_reason('Removed ' || target_user_id::text || ' from ' || target_assignment.host_role));
  return true;
end;
$$;

create or replace function public.can_moderate_radio_listener_target(target_session_id uuid, target_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  target_session public.radio_sessions%rowtype;
  target_community public.communities%rowtype;
  actor_level integer := 0;
  target_level integer := 0;
begin
  if auth.uid() is null or target_user_id = auth.uid() or not public.can_manage_radio_session(target_session_id) then return false; end if;
  select * into target_session from public.radio_sessions session where session.id = target_session_id;
  select * into target_community from public.communities community where community.id = target_session.community_id;
  if target_community.owner_id = target_user_id then return false; end if;
  if target_community.owner_id = auth.uid() then return true; end if;
  select role.level into actor_level from public.community_members member join public.roles role on role.id = member.role_id where member.community_id = target_session.community_id and member.user_id = auth.uid();
  select role.level into target_level from public.community_members member join public.roles role on role.id = member.role_id where member.community_id = target_session.community_id and member.user_id = target_user_id;
  return coalesce(actor_level, 0) > coalesce(target_level, 0);
end;
$$;

create or replace function public.moderate_radio_listener(
  target_session_id uuid,
  target_user_id uuid,
  moderation_action text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare target_session public.radio_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if moderation_action not in ('mute', 'unmute', 'remove') then raise exception 'RADIO_LISTENER_ACTION_INVALID' using errcode = '22023'; end if;
  select * into target_session from public.radio_sessions session where session.id = target_session_id;
  if target_session.id is null then raise exception 'RADIO_SESSION_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.can_moderate_radio_listener_target(target_session_id, target_user_id) then raise exception 'RADIO_LISTENER_HIERARCHY_DENIED' using errcode = '42501'; end if;
  if not exists (select 1 from public.radio_listeners listener where listener.radio_session_id = target_session_id and listener.user_id = target_user_id and listener.left_at is null) then raise exception 'RADIO_LISTENER_NOT_ACTIVE' using errcode = 'P0002'; end if;

  update public.radio_listeners listener
  set muted = case when moderation_action = 'mute' then true when moderation_action = 'unmute' then false else listener.muted end,
      left_at = case when moderation_action = 'remove' then now() else listener.left_at end,
      last_heartbeat_at = now()
  where listener.radio_session_id = target_session_id and listener.user_id = target_user_id and listener.left_at is null;

  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason)
  values(target_session.community_id, auth.uid(), 'moderation_action', 'radio_listener', target_session.id,
    public.redact_audit_reason('Listener ' || target_user_id::text || ': ' || moderation_action));
  return true;
end;
$$;

create or replace function public.list_radio_session_audit(target_session_id uuid, result_limit integer default 30)
returns table(id uuid, actor_id uuid, action_type text, target_type text, reason text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare target_session public.radio_sessions%rowtype;
begin
  if auth.uid() is null or not public.can_manage_radio_session(target_session_id) then raise exception 'RADIO_AUDIT_ACCESS_DENIED' using errcode = '42501'; end if;
  select * into target_session from public.radio_sessions session where session.id = target_session_id;
  if target_session.id is null then raise exception 'RADIO_SESSION_NOT_FOUND' using errcode = 'P0002'; end if;
  return query
    select audit.id, audit.actor_id, audit.action_type, audit.target_type, audit.reason, audit.created_at
    from public.audit_log audit
    where audit.community_id = target_session.community_id
      and audit.target_id = target_session.id
      and audit.target_type in ('radio_session_create', 'radio_session_status', 'radio_session_update', 'radio_host_assignment', 'radio_host_removal', 'radio_listener')
    order by audit.created_at desc
    limit least(greatest(coalesce(result_limit, 30), 1), 100);
end;
$$;

drop policy if exists "radio sessions managed by host or community audio managers" on public.radio_sessions;
drop policy if exists "radio sessions deleted by host or community audio managers" on public.radio_sessions;
create policy "radio sessions hierarchy managed update" on public.radio_sessions for update to authenticated
using (public.can_manage_radio_session(id))
with check (public.can_manage_radio_session(id));
create policy "radio sessions hierarchy managed delete" on public.radio_sessions for delete to authenticated
using (public.can_manage_radio_session(id));

drop policy if exists "radio programs created by hosts" on public.radio_programs;
drop policy if exists "radio programs managed by hosts" on public.radio_programs;
drop policy if exists "radio programs deleted by hosts" on public.radio_programs;
create policy "radio programs role scoped insert" on public.radio_programs for insert to authenticated
with check (
  created_by = auth.uid()
  and (
    public.can_manage_community_kind(community_id, 'radio'::public.community_kind, 'manageRadioPrograms')
    or (host_user_id = auth.uid() and public.can_manage_community_kind(community_id, 'radio'::public.community_kind, 'hostRadio'))
  )
);
create policy "radio programs role scoped update" on public.radio_programs for update to authenticated
using (public.can_manage_radio_program(id))
with check (public.can_manage_radio_program(id));
create policy "radio programs role scoped delete" on public.radio_programs for delete to authenticated
using (public.can_manage_radio_program(id));

revoke insert, update, delete on table public.radio_session_hosts from authenticated;
grant select on table public.radio_session_hosts to authenticated;

revoke all on function public.radio_host_assignment_rank(text) from public, anon;
revoke all on function public.is_radio_assignment_capable(uuid, uuid, text) from public, anon;
revoke all on function public.can_assign_radio_session_host(uuid, uuid, text) from public, anon;
revoke all on function public.can_moderate_radio_listener_target(uuid, uuid) from public, anon;
revoke all on function public.assign_radio_session_host(uuid, uuid, text) from public, anon;
revoke all on function public.remove_radio_session_host(uuid, uuid) from public, anon;
revoke all on function public.moderate_radio_listener(uuid, uuid, text) from public, anon;
revoke all on function public.list_radio_session_audit(uuid, integer) from public, anon;
grant execute on function public.radio_host_assignment_rank(text) to authenticated;
grant execute on function public.is_radio_assignment_capable(uuid, uuid, text) to authenticated;
grant execute on function public.can_assign_radio_session_host(uuid, uuid, text) to authenticated;
grant execute on function public.can_moderate_radio_listener_target(uuid, uuid) to authenticated;
grant execute on function public.assign_radio_session_host(uuid, uuid, text) to authenticated;
grant execute on function public.remove_radio_session_host(uuid, uuid) to authenticated;
grant execute on function public.moderate_radio_listener(uuid, uuid, text) to authenticated;
grant execute on function public.list_radio_session_audit(uuid, integer) to authenticated;

comment on function public.can_assign_radio_session_host(uuid, uuid, text) is 'Hierarchy guard for Radio session assignments. Producers can grant only lower session roles; ownership remains highest.';
comment on function public.remove_radio_session_host(uuid, uuid) is 'Hierarchy-checked session host removal. Primary host transfer is intentionally a separate workflow.';
comment on function public.list_radio_session_audit(uuid, integer) is 'Returns only audit facts for one Radio session to a current authorized session manager.';;
