-- Close legacy community-table RLS gaps only when those optional tables exist.
-- Some Picom deployments use the newer roles/permissions model and never
-- created these legacy tables. Keeping this migration conditional makes the
-- forward-only history safe for both schemas without creating obsolete data.

do $migration$
begin
  if to_regclass('public.community_permissions') is not null then
    execute 'alter table public.community_permissions enable row level security';
    execute 'drop policy if exists "perms readable by members" on public.community_permissions';
    execute $policy$create policy "perms readable by members" on public.community_permissions
      for select using (community_has_role(community_id, array['owner','admin','editor','moderator','member']))$policy$;
    execute 'drop policy if exists "perms staff manage" on public.community_permissions';
    execute $policy$create policy "perms staff manage" on public.community_permissions
      for all using (community_is_staff(community_id)) with check (community_is_staff(community_id))$policy$;
  end if;

  if to_regclass('public.community_mutes') is not null then
    execute 'alter table public.community_mutes enable row level security';
    execute 'drop policy if exists "mutes self or mods read" on public.community_mutes';
    execute $policy$create policy "mutes self or mods read" on public.community_mutes
      for select using ((user_id = auth.uid()) or community_can_ban_members(community_id))$policy$;
    execute 'drop policy if exists "mutes mods manage" on public.community_mutes';
    execute $policy$create policy "mutes mods manage" on public.community_mutes
      for all using (community_can_ban_members(community_id)) with check (community_can_ban_members(community_id))$policy$;
  end if;

  if to_regclass('public.community_reports') is not null then
    execute 'alter table public.community_reports enable row level security';
    execute 'drop policy if exists "reports member insert" on public.community_reports';
    execute $policy$create policy "reports member insert" on public.community_reports
      for insert with check ((reporter_id = auth.uid()) and community_has_role(community_id, array['owner','admin','editor','moderator','member']))$policy$;
    execute 'drop policy if exists "reports reporter or staff read" on public.community_reports';
    execute $policy$create policy "reports reporter or staff read" on public.community_reports
      for select using ((reporter_id = auth.uid()) or community_is_staff(community_id))$policy$;
    execute 'drop policy if exists "reports staff update" on public.community_reports';
    execute $policy$create policy "reports staff update" on public.community_reports
      for update using (community_is_staff(community_id)) with check (community_is_staff(community_id))$policy$;
  end if;

  if to_regclass('public.ownership_transfers') is not null then
    execute 'alter table public.ownership_transfers enable row level security';
    execute 'drop policy if exists "transfers involved or staff read" on public.ownership_transfers';
    execute $policy$create policy "transfers involved or staff read" on public.ownership_transfers
      for select using ((previous_owner = auth.uid()) or (new_owner = auth.uid()) or community_is_staff(community_id))$policy$;
    execute 'drop policy if exists "transfers owner insert" on public.ownership_transfers';
    execute $policy$create policy "transfers owner insert" on public.ownership_transfers
      for insert with check ((previous_owner = auth.uid()) and community_is_owner(community_id))$policy$;
  end if;

  if to_regclass('public.community_voice_sessions') is not null
     and to_regclass('public.community_channels') is not null then
    execute 'alter table public.community_voice_sessions enable row level security';
    execute 'drop policy if exists "voice sessions members read" on public.community_voice_sessions';
    execute $policy$create policy "voice sessions members read" on public.community_voice_sessions
      for select using (exists (select 1 from public.community_channels cc
        where cc.id = channel_id and community_has_role(cc.community_id, array['owner','admin','editor','moderator','member'])))$policy$;
    execute 'drop policy if exists "voice sessions starter insert" on public.community_voice_sessions';
    execute $policy$create policy "voice sessions starter insert" on public.community_voice_sessions
      for insert with check ((started_by = auth.uid()) and exists (select 1 from public.community_channels cc
        where cc.id = channel_id and community_has_role(cc.community_id, array['owner','admin','editor','moderator','member'])))$policy$;
    execute 'drop policy if exists "voice sessions starter or staff update" on public.community_voice_sessions';
    execute $policy$create policy "voice sessions starter or staff update" on public.community_voice_sessions
      for update using ((started_by = auth.uid()) or exists (select 1 from public.community_channels cc
        where cc.id = channel_id and community_is_staff(cc.community_id)))
      with check ((started_by = auth.uid()) or exists (select 1 from public.community_channels cc
        where cc.id = channel_id and community_is_staff(cc.community_id)))$policy$;
  end if;
end;
$migration$;
