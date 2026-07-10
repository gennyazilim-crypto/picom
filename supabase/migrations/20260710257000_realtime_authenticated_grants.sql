-- PostgreSQL table privileges are evaluated before Realtime RLS policies.
-- Grant only the operations Realtime Authorization simulates; the policies in
-- 20260710256000 continue to enforce community/topic membership.
grant usage on schema realtime to authenticated;
grant select, insert on table realtime.messages to authenticated;
