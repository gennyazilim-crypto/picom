-- Task 280: atomic, idempotent public-community join path aligned with visitor RLS.

create or replace function public.join_public_community(target_community_id uuid)
returns table(id uuid, community_id uuid, user_id uuid, role_id uuid, joined_at timestamptz, join_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_community public.communities%rowtype;
  existing_membership public.community_members%rowtype;
  created_membership public.community_members%rowtype;
  default_role_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  select * into target_community from public.communities where communities.id = target_community_id for share;
  if not found then raise exception 'COMMUNITY_NOT_FOUND' using errcode = '22023'; end if;
  if target_community.visibility <> 'public' then raise exception 'PRIVATE_COMMUNITY_INVITE_REQUIRED' using errcode = '42501'; end if;
  if exists (
    select 1 from public.community_bans ban
    where ban.community_id = target_community_id and ban.user_id = auth.uid() and ban.revoked_at is null
  ) then raise exception 'JOIN_BANNED' using errcode = '42501'; end if;

  select * into existing_membership from public.community_members membership
  where membership.community_id = target_community_id and membership.user_id = auth.uid();
  if existing_membership.id is not null then
    return query select existing_membership.id, existing_membership.community_id, existing_membership.user_id,
      existing_membership.role_id, existing_membership.joined_at, 'already_member'::text;
    return;
  end if;

  select role.id into default_role_id from public.roles role
  where role.community_id = target_community_id and (role.is_default = true or lower(role.name) = 'member')
  order by role.is_default desc, role.level asc limit 1;
  if default_role_id is null then raise exception 'DEFAULT_ROLE_MISSING' using errcode = '23514'; end if;

  insert into public.community_members(community_id, user_id, role_id)
  values(target_community_id, auth.uid(), default_role_id)
  on conflict (community_id, user_id) do nothing returning * into created_membership;

  if created_membership.id is null then
    select * into existing_membership from public.community_members membership
    where membership.community_id = target_community_id and membership.user_id = auth.uid();
    return query select existing_membership.id, existing_membership.community_id, existing_membership.user_id,
      existing_membership.role_id, existing_membership.joined_at, 'already_member'::text;
    return;
  end if;

  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason)
  values(target_community_id, auth.uid(), 'member_change', 'member', created_membership.id, public.redact_audit_reason('Public community joined'));
  return query select created_membership.id, created_membership.community_id, created_membership.user_id,
    created_membership.role_id, created_membership.joined_at, 'joined'::text;
end;
$$;

revoke all on function public.join_public_community(uuid) from public, anon;
grant execute on function public.join_public_community(uuid) to authenticated;

comment on function public.join_public_community(uuid) is
  'Authenticated public join only. Private communities remain invite/approval gated; active bans, default role, idempotency, and redacted audit are enforced atomically.';
