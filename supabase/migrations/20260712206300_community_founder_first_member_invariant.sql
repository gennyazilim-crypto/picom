begin;

alter table public.communities
  add column if not exists founder_id uuid references public.profiles(id) on delete restrict;

update public.communities
set founder_id = owner_id
where founder_id is null;

alter table public.communities
  alter column founder_id set not null;

create index if not exists idx_communities_founder_id
  on public.communities(founder_id, created_at);

create or replace function public.enforce_community_founder_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.founder_id := coalesce(new.founder_id, new.owner_id);
    if new.founder_id is distinct from new.owner_id then
      raise exception 'COMMUNITY_FOUNDER_MUST_CREATE' using errcode = '23514';
    end if;
    return new;
  end if;

  if new.founder_id is distinct from old.founder_id then
    raise exception 'COMMUNITY_FOUNDER_IMMUTABLE' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists community_founder_immutable on public.communities;
create trigger community_founder_immutable
before insert or update on public.communities
for each row execute function public.enforce_community_founder_immutable();

insert into public.community_members(community_id, user_id, role_id)
select community.id, community.founder_id, owner_role.id
from public.communities community
join public.roles owner_role
  on owner_role.community_id = community.id
 and owner_role.system_key = 'owner'
where not exists (
  select 1 from public.community_members membership
  where membership.community_id = community.id
)
on conflict on constraint community_members_community_id_user_id_key do nothing;

create or replace function public.enforce_community_first_member_founder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  community_founder uuid;
  membership_role_key text;
begin
  perform 1 from public.communities where id = new.community_id for update;

  if exists (
    select 1 from public.community_members membership
    where membership.community_id = new.community_id
  ) then
    return new;
  end if;

  select community.founder_id
  into community_founder
  from public.communities community
  where community.id = new.community_id;

  select role.system_key
  into membership_role_key
  from public.roles role
  where role.id = new.role_id
    and role.community_id = new.community_id;

  if community_founder is null
    or new.user_id is distinct from community_founder
    or membership_role_key is distinct from 'owner'
  then
    raise exception 'FIRST_COMMUNITY_MEMBER_MUST_BE_FOUNDER' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists community_first_member_founder on public.community_members;
create trigger community_first_member_founder
before insert on public.community_members
for each row execute function public.enforce_community_first_member_founder();

create or replace function public.join_public_community(
  target_community_id uuid,
  accepted_rules_version text default null
)
returns table(
  id uuid,
  community_id uuid,
  user_id uuid,
  role_id uuid,
  joined_at timestamptz,
  join_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_community public.communities%rowtype;
  existing_membership public.community_members%rowtype;
  created_membership public.community_members%rowtype;
  selected_role_id uuid;
  restoring_founder boolean := false;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;

  select community_row.*
  into target_community
  from public.communities community_row
  where community_row.id = target_community_id
  for share;

  if not found then raise exception 'COMMUNITY_NOT_FOUND' using errcode = '22023'; end if;
  if target_community.visibility <> 'public' then raise exception 'PRIVATE_COMMUNITY_INVITE_REQUIRED' using errcode = '42501'; end if;
  if exists (
    select 1 from public.community_bans ban
    where ban.community_id = target_community_id
      and ban.user_id = auth.uid()
      and ban.revoked_at is null
  ) then raise exception 'JOIN_BANNED' using errcode = '42501'; end if;
  if target_community.rules_enabled
    and (accepted_rules_version is null or accepted_rules_version <> target_community.rules_version)
  then raise exception 'RULES_ACCEPTANCE_REQUIRED' using errcode = '42501'; end if;

  select membership.*
  into existing_membership
  from public.community_members membership
  where membership.community_id = target_community_id
    and membership.user_id = auth.uid();

  if existing_membership.id is not null then
    if target_community.rules_enabled then
      update public.community_members membership
      set rules_accepted_at = now(),
          rules_version_accepted = accepted_rules_version
      where membership.id = existing_membership.id
      returning membership.* into existing_membership;
    end if;
    return query
      select existing_membership.id, existing_membership.community_id, existing_membership.user_id,
        existing_membership.role_id, existing_membership.joined_at, 'already_member'::text;
    return;
  end if;

  restoring_founder := auth.uid() = target_community.founder_id;
  if restoring_founder then
    select role.id
    into selected_role_id
    from public.roles role
    where role.community_id = target_community_id
      and role.system_key = 'owner'
    limit 1;
  else
    select role.id
    into selected_role_id
    from public.roles role
    where role.community_id = target_community_id
      and (role.is_default = true or role.system_key = 'member')
    order by role.is_default desc, role.level asc
    limit 1;
  end if;

  if selected_role_id is null then raise exception 'DEFAULT_ROLE_MISSING' using errcode = '23514'; end if;

  insert into public.community_members(
    community_id, user_id, role_id, rules_accepted_at, rules_version_accepted
  )
  values (
    target_community_id,
    auth.uid(),
    selected_role_id,
    case when target_community.rules_enabled then now() end,
    case when target_community.rules_enabled then accepted_rules_version end
  )
  on conflict on constraint community_members_community_id_user_id_key do nothing
  returning * into created_membership;

  if created_membership.id is null then
    select membership.*
    into existing_membership
    from public.community_members membership
    where membership.community_id = target_community_id
      and membership.user_id = auth.uid();
    return query
      select existing_membership.id, existing_membership.community_id, existing_membership.user_id,
        existing_membership.role_id, existing_membership.joined_at, 'already_member'::text;
    return;
  end if;

  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason)
  values (
    target_community_id,
    auth.uid(),
    'member_change',
    'member',
    created_membership.id,
    public.redact_audit_reason(
      case when restoring_founder
        then 'Founder Owner membership restored through public join'
        else 'Public community joined after required rule gate'
      end
    )
  );

  return query
    select created_membership.id, created_membership.community_id, created_membership.user_id,
      created_membership.role_id, created_membership.joined_at,
      case when restoring_founder then 'founder_restored' else 'joined' end::text;
end;
$$;

revoke all on function public.join_public_community(uuid, text) from public, anon;
grant execute on function public.join_public_community(uuid, text) to authenticated;

comment on column public.communities.founder_id is
  'Immutable creator identity. Ownership may transfer, but the original founder never changes.';
comment on function public.enforce_community_first_member_founder() is
  'Serializes first membership creation and requires the immutable founder with the Owner role.';
comment on function public.join_public_community(uuid, text) is
  'Idempotent public join. Missing founder membership is restored as Owner; all later joins use the default Member role.';

commit;