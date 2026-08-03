-- Live Now realtime badge revocation: deliver UPDATE events to authenticated viewers
-- when a publisher badge/profile leaves active status.
--
-- Root cause: publisher_badges / publisher_profiles were not in supabase_realtime,
-- and SELECT policies hid non-active rows from other users, so Realtime RLS filtering
-- dropped the suspend/revoke UPDATE. Discovery RPCs remain the authority for listing.
-- Does not change Case 04 eligibility counting or Case 18 discovery predicates.

begin;

drop policy if exists publisher_badges_select on public.publisher_badges;
create policy publisher_badges_select on public.publisher_badges
  for select to authenticated
  using (
    user_id = auth.uid()
    or status in ('active', 'suspended', 'revoked', 'expired')
    or public.can_list_publisher_applications()
  );

drop policy if exists publisher_profiles_select on public.publisher_profiles;
create policy publisher_profiles_select on public.publisher_profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or status in ('active', 'suspended', 'revoked')
    or public.can_list_publisher_applications()
  );

do $pub$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.publisher_badges;
    exception when duplicate_object then
      null;
    end;
    begin
      alter publication supabase_realtime add table public.publisher_profiles;
    exception when duplicate_object then
      null;
    end;
  end if;
end;
$pub$;

comment on policy publisher_badges_select on public.publisher_badges is
  'Authenticated may read active and post-active badge states so Live Now clients receive Realtime revoke/suspend updates. Listing eligibility still uses active-only helpers.';

comment on policy publisher_profiles_select on public.publisher_profiles is
  'Authenticated may read active and post-active publisher profile states for Realtime revocation refresh. Discovery RPCs enforce active eligibility.';

commit;
