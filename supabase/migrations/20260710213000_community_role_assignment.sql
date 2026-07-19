-- Task 281: hierarchy-safe community role assignment with append-only audit metadata.

create or replace function public.assign_community_member_role(
  target_community_id uuid,
  target_member_id uuid,
  target_role_id uuid,
  change_reason text default 'Role assigned in community admin panel'
)
returns table(id uuid, community_id uuid, user_id uuid, role_id uuid, joined_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  community_record public.communities%rowtype;
  actor_membership public.community_members%rowtype;
  actor_role public.roles%rowtype;
  target_membership public.community_members%rowtype;
  current_target_role public.roles%rowtype;
  next_role public.roles%rowtype;
begin
  if auth.uid() is null then raise exception 'PERMISSION_DENIED' using errcode = '42501'; end if;
  if char_length(btrim(change_reason)) < 10 or char_length(change_reason) > 300 then raise exception 'ROLE_ASSIGNMENT_INVALID' using errcode = '22023'; end if;

  select * into community_record from public.communities where communities.id = target_community_id;
  select * into actor_membership from public.community_members membership where membership.community_id = target_community_id and membership.user_id = auth.uid();
  select * into actor_role from public.roles role where role.id = actor_membership.role_id and role.community_id = target_community_id;
  select * into target_membership from public.community_members membership where membership.id = target_member_id and membership.community_id = target_community_id for update;
  select * into current_target_role from public.roles role where role.id = target_membership.role_id and role.community_id = target_community_id;
  select * into next_role from public.roles role where role.id = target_role_id and role.community_id = target_community_id;

  if community_record.id is null or actor_membership.id is null or actor_role.id is null or target_membership.id is null or current_target_role.id is null or next_role.id is null then
    raise exception 'ROLE_ASSIGNMENT_INVALID' using errcode = '22023';
  end if;
  if target_membership.user_id = community_record.owner_id or current_target_role.level >= 100 or next_role.level >= 100 or lower(next_role.name) = 'owner' then
    raise exception 'OWNER_ROLE_TRANSFER_REQUIRED' using errcode = '42501';
  end if;
  if community_record.owner_id <> auth.uid() and (
    actor_role.level < 80 or current_target_role.level >= actor_role.level or next_role.level >= actor_role.level
  ) then raise exception 'ROLE_HIERARCHY_DENIED' using errcode = '42501'; end if;

  if target_membership.role_id <> next_role.id then
    update public.community_members set role_id = next_role.id where community_members.id = target_membership.id returning * into target_membership;
    insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason)
    values(target_community_id, auth.uid(), 'role_change', 'member', target_membership.id,
      public.redact_audit_reason('Role changed from ' || current_target_role.name || ' to ' || next_role.name || ': ' || change_reason));
  end if;

  return query select target_membership.id, target_membership.community_id, target_membership.user_id, target_membership.role_id, target_membership.joined_at;
end;
$$;
revoke all on function public.assign_community_member_role(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.assign_community_member_role(uuid, uuid, uuid, text) to authenticated;
comment on function public.assign_community_member_role(uuid, uuid, uuid, text) is
  'Owners manage non-owner roles. Admins can manage and assign only roles below their own level. Ownership changes remain in the transfer workflow.';
