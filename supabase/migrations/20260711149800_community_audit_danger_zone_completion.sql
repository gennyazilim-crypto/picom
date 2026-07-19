-- Task 498: re-authenticated UI flows backed by atomic ownership/archive RPCs and append-only evidence.
begin;

drop function if exists public.transfer_community_ownership(uuid, uuid, text);

create function public.transfer_community_ownership(
  target_community_id uuid,
  target_new_owner_id uuid,
  confirmation_community_name text,
  transfer_reason text
)
returns table(community_id uuid, previous_owner_id uuid, new_owner_id uuid, transferred_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_community public.communities%rowtype;
  previous_membership public.community_members%rowtype;
  target_membership public.community_members%rowtype;
  owner_role_id uuid;
  fallback_role_id uuid;
  previous_old_roles uuid[];
  target_old_roles uuid[];
  previous_new_roles uuid[];
  target_new_roles uuid[];
  clean_reason text := public.redact_audit_reason(transfer_reason);
  transfer_time timestamptz := now();
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if clean_reason is null or char_length(clean_reason) < 10 then raise exception 'COMMUNITY_TRANSFER_REASON_REQUIRED' using errcode = '22023'; end if;

  select * into target_community from public.communities community where community.id = target_community_id for update;
  if target_community.id is null then raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002'; end if;
  if target_community.archived_at is not null then raise exception 'COMMUNITY_ARCHIVED' using errcode = '55000'; end if;
  if target_community.owner_id <> auth.uid() then raise exception 'COMMUNITY_TRANSFER_OWNER_REQUIRED' using errcode = '42501'; end if;
  if btrim(coalesce(confirmation_community_name, '')) <> target_community.name then raise exception 'COMMUNITY_TRANSFER_CONFIRMATION_MISMATCH' using errcode = '22023'; end if;
  if target_new_owner_id = auth.uid() then raise exception 'COMMUNITY_TRANSFER_TARGET_INVALID' using errcode = '22023'; end if;

  select * into previous_membership from public.community_members membership where membership.community_id = target_community_id and membership.user_id = auth.uid() for update;
  select * into target_membership from public.community_members membership where membership.community_id = target_community_id and membership.user_id = target_new_owner_id for update;
  if previous_membership.id is null then raise exception 'COMMUNITY_OWNER_MEMBERSHIP_MISSING' using errcode = '23503'; end if;
  if target_membership.id is null or exists(select 1 from public.community_bans ban where ban.community_id = target_community_id and ban.user_id = target_new_owner_id and ban.revoked_at is null) then raise exception 'COMMUNITY_TRANSFER_TARGET_NOT_MEMBER' using errcode = '23503'; end if;

  select role.id into owner_role_id from public.roles role where role.community_id = target_community_id and (role.system_key = 'owner' or lower(role.name) = 'owner') order by role.level desc limit 1;
  select role.id into fallback_role_id from public.roles role where role.community_id = target_community_id and coalesce(role.system_key, '') <> 'owner' and lower(role.name) <> 'owner' order by case when coalesce(role.system_key, lower(role.name)) = 'admin' then 0 when coalesce(role.system_key, lower(role.name)) = 'member' then 2 else 1 end, role.level desc limit 1;
  if owner_role_id is null or fallback_role_id is null then raise exception 'COMMUNITY_TRANSFER_ROLE_CONFIGURATION_INVALID' using errcode = '23514'; end if;

  select coalesce(array_agg(link.role_id order by link.role_id), array[previous_membership.role_id]) into previous_old_roles from public.community_member_roles link where link.member_id = previous_membership.id;
  select coalesce(array_agg(link.role_id order by link.role_id), array[target_membership.role_id]) into target_old_roles from public.community_member_roles link where link.member_id = target_membership.id;

  delete from public.community_member_roles where community_member_roles.community_id = target_community_id and community_member_roles.role_id = owner_role_id;
  update public.communities set owner_id = target_new_owner_id, updated_at = transfer_time where communities.id = target_community_id;
  update public.community_members set role_id = fallback_role_id where id = previous_membership.id;
  update public.community_members set role_id = owner_role_id where id = target_membership.id;

  insert into public.community_member_roles(community_id, member_id, role_id, is_primary, assigned_by)
  values(target_community_id, previous_membership.id, fallback_role_id, true, auth.uid())
  on conflict(member_id, role_id) do update set is_primary = true, assigned_by = excluded.assigned_by, assigned_at = now();
  insert into public.community_member_roles(community_id, member_id, role_id, is_primary, assigned_by)
  values(target_community_id, target_membership.id, owner_role_id, true, auth.uid())
  on conflict(member_id, role_id) do update set is_primary = true, assigned_by = excluded.assigned_by, assigned_at = now();

  update public.community_member_roles set is_primary = false where member_id = previous_membership.id and role_id <> fallback_role_id;
  update public.community_member_roles set is_primary = false where member_id = target_membership.id and role_id <> owner_role_id;
  select array_agg(role_id order by role_id) into previous_new_roles from public.community_member_roles where member_id = previous_membership.id;
  select array_agg(role_id order by role_id) into target_new_roles from public.community_member_roles where member_id = target_membership.id;

  insert into public.community_member_role_audit(community_id, member_id, target_user_id, actor_id, old_role_ids, new_role_ids, reason)
  values
    (target_community_id, previous_membership.id, previous_membership.user_id, auth.uid(), previous_old_roles, previous_new_roles, clean_reason),
    (target_community_id, target_membership.id, target_membership.user_id, auth.uid(), target_old_roles, target_new_roles, clean_reason);
  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason)
  values(target_community_id, auth.uid(), 'community_update', 'ownership_transfer', target_new_owner_id, clean_reason);

  return query select target_community_id, auth.uid(), target_new_owner_id, transfer_time;
end;
$$;

create or replace function public.archive_community(
  target_community_id uuid,
  confirmation_community_name text,
  archive_reason text default null
)
returns table(community_id uuid, archived_at timestamptz, archived_by uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_community public.communities%rowtype;
  archive_time timestamptz := now();
  clean_reason text := public.redact_audit_reason(archive_reason);
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if clean_reason is null or char_length(clean_reason) < 10 then raise exception 'COMMUNITY_ARCHIVE_REASON_REQUIRED' using errcode = '22023'; end if;
  select * into target_community from public.communities community where community.id = target_community_id for update;
  if target_community.id is null then raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002'; end if;
  if target_community.owner_id <> auth.uid() then raise exception 'COMMUNITY_ARCHIVE_OWNER_REQUIRED' using errcode = '42501'; end if;
  if target_community.archived_at is not null then raise exception 'COMMUNITY_ALREADY_ARCHIVED' using errcode = '55000'; end if;
  if btrim(coalesce(confirmation_community_name, '')) <> target_community.name then raise exception 'COMMUNITY_ARCHIVE_CONFIRMATION_MISMATCH' using errcode = '22023'; end if;

  update public.communities set archived_at = archive_time, archived_by = auth.uid(), archive_reason = clean_reason, visibility = 'private', public_read_enabled = false, discovery_listed = false, updated_at = archive_time where communities.id = target_community_id;
  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason)
  values(target_community_id, auth.uid(), 'community_update', 'community_archive', target_community_id, clean_reason);
  return query select target_community_id, archive_time, auth.uid();
end;
$$;

revoke all on function public.transfer_community_ownership(uuid, uuid, text, text) from public, anon;
revoke all on function public.archive_community(uuid, text, text) from public, anon;
grant execute on function public.transfer_community_ownership(uuid, uuid, text, text) to authenticated;
grant execute on function public.archive_community(uuid, text, text) to authenticated;

comment on function public.transfer_community_ownership(uuid, uuid, text, text) is 'Owner-only atomic ownership and multi-role transfer to an active member. The desktop service requires current-password reauthentication before invocation.';
comment on function public.archive_community(uuid, text, text) is 'Owner-only recoverable archive with typed confirmation, reason, retained rows, and append-only audit evidence.';;
