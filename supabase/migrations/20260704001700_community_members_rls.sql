-- RLS policies for public.community_members
-- Members can read member lists for communities they belong to; owners manage membership rows.

create or replace function public.is_community_owner(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.communities community
    where community.id = target_community_id
      and community.owner_id = auth.uid()
  );
$$;
grant execute on function public.is_community_owner(uuid) to authenticated;
grant select, insert, update, delete on public.community_members to authenticated;
alter table public.community_members enable row level security;
drop policy if exists "community_members_select_same_community" on public.community_members;
create policy "community_members_select_same_community"
on public.community_members
for select
to authenticated
using (public.is_community_member(community_id));
drop policy if exists "community_members_insert_owner_or_self_owner" on public.community_members;
create policy "community_members_insert_owner_or_self_owner"
on public.community_members
for insert
to authenticated
with check (
  public.is_community_owner(community_id)
  or (user_id = auth.uid() and public.is_community_owner(community_id))
);
drop policy if exists "community_members_update_owner" on public.community_members;
create policy "community_members_update_owner"
on public.community_members
for update
to authenticated
using (public.is_community_owner(community_id))
with check (public.is_community_owner(community_id));
drop policy if exists "community_members_delete_owner" on public.community_members;
create policy "community_members_delete_owner"
on public.community_members
for delete
to authenticated
using (public.is_community_owner(community_id));
