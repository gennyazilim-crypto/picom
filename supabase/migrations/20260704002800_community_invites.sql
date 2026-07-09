-- Community invite creation and atomic acceptance for Picom Full MVP.

create table if not exists public.community_invites (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Za-z0-9_-]{8,64}$'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  max_uses integer check (max_uses is null or max_uses between 1 and 1000),
  uses integer not null default 0 check (uses >= 0),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_community_invites_community_created on public.community_invites(community_id, created_at desc);
create index if not exists idx_community_invites_active on public.community_invites(code) where revoked_at is null;
alter table public.community_invites enable row level security;

create or replace function public.can_create_community_invite(target_community_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_community_owner(target_community_id) or exists (
    select 1 from public.community_members membership
    join public.roles role on role.id = membership.role_id
    where membership.community_id = target_community_id
      and membership.user_id = auth.uid()
      and (role.level >= 60 or coalesce((role.permissions ->> 'createInvites')::boolean, false))
  );
$$;

grant execute on function public.can_create_community_invite(uuid) to authenticated;
grant select, insert, update on public.community_invites to authenticated;

create policy "community_invites_manage_select" on public.community_invites for select to authenticated using (public.can_create_community_invite(community_id));
create policy "community_invites_create" on public.community_invites for insert to authenticated with check (created_by = auth.uid() and public.can_create_community_invite(community_id));
create policy "community_invites_revoke" on public.community_invites for update to authenticated using (public.can_create_community_invite(community_id)) with check (public.can_create_community_invite(community_id));

create or replace function public.accept_community_invite(invite_code text)
returns table (id uuid, community_id uuid, user_id uuid, role_id uuid, joined_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  target_invite public.community_invites%rowtype;
  default_role_id uuid;
  inserted_count integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into target_invite from public.community_invites where code = invite_code for update;
  if not found then raise exception 'invalid invite'; end if;
  if target_invite.revoked_at is not null then raise exception 'revoked invite'; end if;
  if target_invite.expires_at is not null and target_invite.expires_at <= now() then raise exception 'expired invite'; end if;
  if target_invite.max_uses is not null and target_invite.uses >= target_invite.max_uses then raise exception 'exhausted invite'; end if;

  select role.id into default_role_id from public.roles role where role.community_id = target_invite.community_id and role.name = 'Member' order by role.level asc limit 1;
  insert into public.community_members (community_id, user_id, role_id)
  values (target_invite.community_id, auth.uid(), default_role_id)
  on conflict (community_id, user_id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count > 0 then update public.community_invites set uses = uses + 1 where community_invites.id = target_invite.id; end if;

  return query select membership.id, membership.community_id, membership.user_id, membership.role_id, membership.joined_at from public.community_members membership where membership.community_id = target_invite.community_id and membership.user_id = auth.uid();
end;
$$;

revoke all on function public.accept_community_invite(text) from public;
grant execute on function public.accept_community_invite(text) to authenticated;
