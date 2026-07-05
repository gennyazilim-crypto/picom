-- Community menu role/access RLS smoke plan.
-- Run after applying migrations with Supabase CLI or a staging database.
-- This file is intentionally read-oriented and avoids destructive production operations.

-- Expected checks:
-- 1. Public community rows are visible to anon/authenticated visitors.
-- 2. Private community rows are visible only to members/owners.
-- 3. Public, non-private channels with public_read_enabled=true are visible to visitors.
-- 4. Private channels are not visible to visitors.
-- 5. Public channel messages are selectable for visitors when community public_read_enabled=true.
-- 6. Message inserts require authenticated community membership.
-- 7. Public self-join inserts only allow the Member role or null role.
-- 8. Owners cannot self-leave without ownership transfer handled by app logic.

select 'community_menu_role_access_rls_smoke_placeholder' as test_name;
