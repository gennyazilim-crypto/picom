-- RLS policies for public.communities
-- Communities are visible to their owner and members.

create or replace function public.is_community_member(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_members membership
    where membership.community_id = target_community_id
      and membership.user_id = auth.uid()
  );
$$;
grant execute on function public.is_community_member(uuid) to authenticated;
grant select, insert, update on public.communities to authenticated;
alter table public.communities enable row level security;
drop policy if exists "communities_select_owned_or_member" on public.communities;
create policy "communities_select_owned_or_member"
on public.communities
for select
to authenticated
using (owner_id = auth.uid() or public.is_community_member(id));
drop policy if exists "communities_insert_own" on public.communities;
create policy "communities_insert_own"
on public.communities
for insert
to authenticated
with check (owner_id = auth.uid());
drop policy if exists "communities_update_owner" on public.communities;
create policy "communities_update_owner"
on public.communities
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());
