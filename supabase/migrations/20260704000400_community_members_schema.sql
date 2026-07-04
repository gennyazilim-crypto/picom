-- Community members table schema hardening
-- Enforces role/community consistency for MVP membership records.

create index if not exists idx_community_members_role_id on public.community_members(role_id);

create or replace function public.ensure_member_role_matches_community()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role_id is not null and not exists (
    select 1
    from public.roles r
    where r.id = new.role_id
      and r.community_id = new.community_id
  ) then
    raise exception 'role_id must belong to the same community' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_community_members_role_matches_community on public.community_members;
create trigger trg_community_members_role_matches_community
before insert or update of community_id, role_id on public.community_members
for each row
execute function public.ensure_member_role_matches_community();