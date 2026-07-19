-- Task 325: optional, versioned community-rule acceptance for public joins.
alter table public.communities add column if not exists rules_enabled boolean not null default false;
alter table public.communities add column if not exists rules_version text not null default '1';
alter table public.community_members add column if not exists rules_accepted_at timestamptz;
alter table public.community_members add column if not exists rules_version_accepted text;
create table if not exists public.community_rules (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null check(char_length(title) between 1 and 120),
  body text not null check(char_length(body) between 1 and 2000),
  position integer not null default 0 check(position >= 0),
  required boolean not null default true,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(community_id, position)
);
create index if not exists idx_community_rules_community_position on public.community_rules(community_id, position);
alter table public.community_rules enable row level security;
grant select, insert, update, delete on public.community_rules to authenticated;
drop policy if exists community_rules_visible on public.community_rules;
create policy community_rules_visible on public.community_rules for select to authenticated using (
  (published and exists(select 1 from public.communities c where c.id=community_id and (c.visibility='public' or public.is_community_member(c.id))))
  or public.is_community_owner(community_id)
  or exists(select 1 from public.community_members cm join public.roles r on r.id=cm.role_id where cm.community_id=community_rules.community_id and cm.user_id=auth.uid() and lower(r.name)='admin')
);
drop policy if exists community_rules_owner_admin_manage on public.community_rules;
create policy community_rules_owner_admin_manage on public.community_rules for all to authenticated using (
  public.is_community_owner(community_id)
  or exists(select 1 from public.community_members cm join public.roles r on r.id=cm.role_id where cm.community_id=community_rules.community_id and cm.user_id=auth.uid() and lower(r.name)='admin')
) with check (
  public.is_community_owner(community_id)
  or exists(select 1 from public.community_members cm join public.roles r on r.id=cm.role_id where cm.community_id=community_rules.community_id and cm.user_id=auth.uid() and lower(r.name)='admin')
);
drop function if exists public.join_public_community(uuid);
create function public.join_public_community(target_community_id uuid, accepted_rules_version text default null)
returns table(id uuid, community_id uuid, user_id uuid, role_id uuid, joined_at timestamptz, join_status text)
language plpgsql security definer set search_path=public as $$
declare target_community public.communities%rowtype; existing_membership public.community_members%rowtype; created_membership public.community_members%rowtype; default_role_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  select * into target_community from public.communities where communities.id=target_community_id for share;
  if not found then raise exception 'COMMUNITY_NOT_FOUND' using errcode='22023'; end if;
  if target_community.visibility<>'public' then raise exception 'PRIVATE_COMMUNITY_INVITE_REQUIRED' using errcode='42501'; end if;
  if exists(select 1 from public.community_bans b where b.community_id=target_community_id and b.user_id=auth.uid() and b.revoked_at is null) then raise exception 'JOIN_BANNED' using errcode='42501'; end if;
  if target_community.rules_enabled and (accepted_rules_version is null or accepted_rules_version<>target_community.rules_version) then raise exception 'RULES_ACCEPTANCE_REQUIRED' using errcode='42501'; end if;
  select * into existing_membership from public.community_members m where m.community_id=target_community_id and m.user_id=auth.uid();
  if existing_membership.id is not null then
    if target_community.rules_enabled then update public.community_members set rules_accepted_at=now(),rules_version_accepted=accepted_rules_version where community_members.id=existing_membership.id returning * into existing_membership; end if;
    return query select existing_membership.id,existing_membership.community_id,existing_membership.user_id,existing_membership.role_id,existing_membership.joined_at,'already_member'::text; return;
  end if;
  select r.id into default_role_id from public.roles r where r.community_id=target_community_id and (r.is_default=true or lower(r.name)='member') order by r.is_default desc,r.level asc limit 1;
  if default_role_id is null then raise exception 'DEFAULT_ROLE_MISSING' using errcode='23514'; end if;
  insert into public.community_members(community_id,user_id,role_id,rules_accepted_at,rules_version_accepted) values(target_community_id,auth.uid(),default_role_id,case when target_community.rules_enabled then now() end,case when target_community.rules_enabled then accepted_rules_version end) on conflict(community_id,user_id) do nothing returning * into created_membership;
  if created_membership.id is null then select * into existing_membership from public.community_members m where m.community_id=target_community_id and m.user_id=auth.uid(); return query select existing_membership.id,existing_membership.community_id,existing_membership.user_id,existing_membership.role_id,existing_membership.joined_at,'already_member'::text; return; end if;
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason) values(target_community_id,auth.uid(),'member_change','member',created_membership.id,public.redact_audit_reason('Public community joined after required rule gate'));
  return query select created_membership.id,created_membership.community_id,created_membership.user_id,created_membership.role_id,created_membership.joined_at,'joined'::text;
end; $$;
revoke all on function public.join_public_community(uuid,text) from public,anon;
grant execute on function public.join_public_community(uuid,text) to authenticated;
comment on function public.join_public_community(uuid,text) is 'Atomic public join. When rules are enabled, records the server acceptance timestamp and exact rules version; no rule content enters audit logs.';
comment on column public.communities.rules_enabled is 'Safe rollout switch. Keep false until owner content and legal/product review are complete.';
