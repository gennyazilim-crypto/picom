-- RLS policies for public.profiles
-- Profiles are visible to the owner and to users who share a community.

create or replace function public.can_view_profile(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() = profile_id
    or exists (
      select 1
      from public.community_members viewer_membership
      join public.community_members target_membership
        on target_membership.community_id = viewer_membership.community_id
      where viewer_membership.user_id = auth.uid()
        and target_membership.user_id = profile_id
    );
$$;
grant execute on function public.can_view_profile(uuid) to authenticated;
grant select, insert, update on public.profiles to authenticated;
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_visible" on public.profiles;
create policy "profiles_select_visible"
on public.profiles
for select
to authenticated
using (public.can_view_profile(id));
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
