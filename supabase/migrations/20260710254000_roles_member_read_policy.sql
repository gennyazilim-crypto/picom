-- Role definitions are required to resolve a member's effective permissions.
-- Keep them private to the owning community; visitors receive no role rows.
grant select on public.roles to authenticated;
drop policy if exists "roles_select_community_members" on public.roles;
create policy "roles_select_community_members"
on public.roles
for select
to authenticated
using (
  public.is_community_owner(community_id)
  or public.is_community_member(community_id)
);
