-- Close the critical RLS gap on 5 community tables that were exposed to the anon key.
-- Applied to the live "piso" (Picom prod) project on 2026-07-15 via apply_migration.
-- Additive + reversible: only enables RLS and adds policies mirroring the proven
-- sibling-table patterns (community_bans / community_members). Server-side writes via
-- service_role bypass RLS and are unaffected.
--
-- Helper functions (SECURITY DEFINER, confirmed present in prod):
--   community_is_staff(uuid), community_can_ban_members(uuid),
--   community_has_role(uuid, text[]), community_is_banned(uuid, uuid), community_is_owner(uuid)

-- 1) community_permissions (role/permission config)
alter table public.community_permissions enable row level security;
create policy "perms readable by members" on public.community_permissions
  for select using (community_has_role(community_id, array['owner','admin','editor','moderator','member']));
create policy "perms staff manage" on public.community_permissions
  for all using (community_is_staff(community_id)) with check (community_is_staff(community_id));

-- 2) community_mutes (mirror of community_bans)
alter table public.community_mutes enable row level security;
create policy "mutes self or mods read" on public.community_mutes
  for select using ((user_id = auth.uid()) or community_can_ban_members(community_id));
create policy "mutes mods manage" on public.community_mutes
  for all using (community_can_ban_members(community_id)) with check (community_can_ban_members(community_id));

-- 3) community_reports
alter table public.community_reports enable row level security;
create policy "reports member insert" on public.community_reports
  for insert with check ((reporter_id = auth.uid()) and community_has_role(community_id, array['owner','admin','editor','moderator','member']));
create policy "reports reporter or staff read" on public.community_reports
  for select using ((reporter_id = auth.uid()) or community_is_staff(community_id));
create policy "reports staff update" on public.community_reports
  for update using (community_is_staff(community_id)) with check (community_is_staff(community_id));

-- 4) ownership_transfers (append-only, owner-initiated)
alter table public.ownership_transfers enable row level security;
create policy "transfers involved or staff read" on public.ownership_transfers
  for select using ((previous_owner = auth.uid()) or (new_owner = auth.uid()) or community_is_staff(community_id));
create policy "transfers owner insert" on public.ownership_transfers
  for insert with check ((previous_owner = auth.uid()) and community_is_owner(community_id));

-- 5) community_voice_sessions (channel -> community)
alter table public.community_voice_sessions enable row level security;
create policy "voice sessions members read" on public.community_voice_sessions
  for select using (exists (select 1 from public.community_channels cc
    where cc.id = channel_id and community_has_role(cc.community_id, array['owner','admin','editor','moderator','member'])));
create policy "voice sessions starter insert" on public.community_voice_sessions
  for insert with check ((started_by = auth.uid()) and exists (select 1 from public.community_channels cc
    where cc.id = channel_id and community_has_role(cc.community_id, array['owner','admin','editor','moderator','member'])));
create policy "voice sessions starter or staff update" on public.community_voice_sessions
  for update using ((started_by = auth.uid()) or exists (select 1 from public.community_channels cc
    where cc.id = channel_id and community_is_staff(cc.community_id)))
  with check ((started_by = auth.uid()) or exists (select 1 from public.community_channels cc
    where cc.id = channel_id and community_is_staff(cc.community_id)));

-- Rollback (if needed):
--   drop policy ... ; alter table ... disable row level security;
