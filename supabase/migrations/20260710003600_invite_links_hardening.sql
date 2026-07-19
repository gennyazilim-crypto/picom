-- Harden invite acceptance without exposing invite secrets to the renderer.

create table if not exists public.community_bans (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  banned_by uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (community_id, user_id)
);
alter table public.community_bans enable row level security;
create policy "community_bans_manager_select" on public.community_bans
for select to authenticated
using (public.can_create_community_invite(community_id));
create or replace function public.accept_community_invite(invite_code text)
returns table (id uuid, community_id uuid, user_id uuid, role_id uuid, joined_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  target_invite public.community_invites%rowtype;
  default_role_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into target_invite from public.community_invites where code = invite_code for update;
  if not found then raise exception 'invalid invite'; end if;
  if target_invite.revoked_at is not null then raise exception 'revoked invite'; end if;
  if target_invite.expires_at is not null and target_invite.expires_at <= now() then raise exception 'expired invite'; end if;
  if exists (select 1 from public.community_bans ban where ban.community_id = target_invite.community_id and ban.user_id = auth.uid() and ban.revoked_at is null) then raise exception 'banned user'; end if;

  if exists (select 1 from public.community_members membership where membership.community_id = target_invite.community_id and membership.user_id = auth.uid()) then
    return query select membership.id, membership.community_id, membership.user_id, membership.role_id, membership.joined_at from public.community_members membership where membership.community_id = target_invite.community_id and membership.user_id = auth.uid();
    return;
  end if;

  if target_invite.max_uses is not null and target_invite.uses >= target_invite.max_uses then raise exception 'exhausted invite'; end if;
  select role.id into default_role_id from public.roles role where role.community_id = target_invite.community_id and role.name = 'Member' order by role.level asc limit 1;
  insert into public.community_members (community_id, user_id, role_id) values (target_invite.community_id, auth.uid(), default_role_id);
  update public.community_invites set uses = uses + 1 where community_invites.id = target_invite.id;
  return query select membership.id, membership.community_id, membership.user_id, membership.role_id, membership.joined_at from public.community_members membership where membership.community_id = target_invite.community_id and membership.user_id = auth.uid();
end;
$$;
revoke all on function public.accept_community_invite(text) from public;
grant execute on function public.accept_community_invite(text) to authenticated;
