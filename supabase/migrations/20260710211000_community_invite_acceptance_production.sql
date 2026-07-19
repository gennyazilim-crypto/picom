-- Task 279: atomically validate and accept community invites with stable result/error codes.

create unique index if not exists idx_community_invites_code_lower
  on public.community_invites(lower(code));
create or replace function public.accept_community_invite_v2(invite_code text)
returns table(id uuid, community_id uuid, user_id uuid, role_id uuid, joined_at timestamptz, acceptance_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text := lower(btrim(invite_code));
  target_invite public.community_invites%rowtype;
  existing_membership public.community_members%rowtype;
  created_membership public.community_members%rowtype;
  default_role_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if normalized_code is null or normalized_code !~ '^[a-z0-9_-]{8,64}$' then raise exception 'INVITE_INVALID' using errcode = '22023'; end if;

  select * into target_invite from public.community_invites
  where lower(code) = normalized_code for update;
  if not found then raise exception 'INVITE_INVALID' using errcode = '22023'; end if;
  if target_invite.revoked_at is not null then raise exception 'INVITE_REVOKED' using errcode = '22023'; end if;
  if target_invite.expires_at is not null and target_invite.expires_at <= now() then raise exception 'INVITE_EXPIRED' using errcode = '22023'; end if;
  if exists (
    select 1 from public.community_bans ban
    where ban.community_id = target_invite.community_id and ban.user_id = auth.uid() and ban.revoked_at is null
  ) then raise exception 'INVITE_BANNED' using errcode = '42501'; end if;

  select * into existing_membership from public.community_members membership
  where membership.community_id = target_invite.community_id and membership.user_id = auth.uid();
  if existing_membership.id is not null then
    return query select existing_membership.id, existing_membership.community_id, existing_membership.user_id,
      existing_membership.role_id, existing_membership.joined_at, 'already_member'::text;
    return;
  end if;

  if target_invite.max_uses is not null and target_invite.uses >= target_invite.max_uses then
    raise exception 'INVITE_EXHAUSTED' using errcode = '22023';
  end if;

  select role.id into default_role_id from public.roles role
  where role.community_id = target_invite.community_id and (role.is_default = true or lower(role.name) = 'member')
  order by role.is_default desc, role.level asc limit 1;
  if default_role_id is null then raise exception 'DEFAULT_ROLE_MISSING' using errcode = '23514'; end if;

  insert into public.community_members(community_id, user_id, role_id)
  values(target_invite.community_id, auth.uid(), default_role_id)
  on conflict (community_id, user_id) do nothing
  returning * into created_membership;

  if created_membership.id is null then
    select * into existing_membership from public.community_members membership
    where membership.community_id = target_invite.community_id and membership.user_id = auth.uid();
    return query select existing_membership.id, existing_membership.community_id, existing_membership.user_id,
      existing_membership.role_id, existing_membership.joined_at, 'already_member'::text;
    return;
  end if;

  update public.community_invites set uses = uses + 1, last_used_at = now() where community_invites.id = target_invite.id;
  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason)
  values(target_invite.community_id, auth.uid(), 'invite_accept', 'invite', target_invite.id, public.redact_audit_reason('Invite accepted'));

  return query select created_membership.id, created_membership.community_id, created_membership.user_id,
    created_membership.role_id, created_membership.joined_at, 'joined'::text;
end;
$$;
revoke all on function public.accept_community_invite_v2(text) from public, anon;
grant execute on function public.accept_community_invite_v2(text) to authenticated;
comment on function public.accept_community_invite_v2(text) is
  'Atomically validates invite state, bans, membership, default role, use count, and redacted audit metadata. Never exposes invite secrets in audit logs.';
