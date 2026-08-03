-- Hosted RLS / visibility smoke for community live screen sessions.
-- Run with authenticated JWT contexts (owner / outsider / anon) via the
-- hosted regression harness or manual Supabase SQL editor with set_config.

-- Expectation matrix (document results in the Live readiness report):
-- 1) authenticated member of community + can_view_channel: SELECT allowed for live rows
-- 2) authenticated non-member of private/secret community: SELECT denied
-- 3) blocked broadcaster relationship: SELECT denied via can_view_live_screen_session
-- 4) anon: no EXECUTE on list/count RPCs; table SELECT denied
-- 5) only broadcaster upserts; second sharer on same channel gets LIVE_SHARE_CONFLICT
-- 6) moderator level>=80 can end_community_live_screen_session as terminated
-- 7) service_role can cleanup_stale_community_live_screen_sessions
-- 8) hidden community via community_live_hidden_communities excludes from visibility

select
  to_regclass('public.community_live_screen_sessions') is not null as sessions_table,
  to_regclass('public.community_live_screen_viewers') is not null as viewers_table,
  to_regprocedure('public.list_visible_live_screen_sessions(text,text,integer,timestamptz,uuid)') is not null as list_rpc,
  to_regprocedure('public.count_visible_live_screen_sessions()') is not null as count_rpc,
  to_regprocedure('public.upsert_community_live_screen_session(uuid,uuid,text,text,text,text,integer)') is not null as upsert_rpc,
  to_regprocedure('public.end_community_live_screen_session(uuid,text)') is not null as end_rpc,
  to_regprocedure('public.cleanup_stale_community_live_screen_sessions(integer,integer)') is not null as cleanup_rpc,
  has_function_privilege('anon', 'public.count_visible_live_screen_sessions()', 'EXECUTE') as anon_can_count,
  has_function_privilege('authenticated', 'public.count_visible_live_screen_sessions()', 'EXECUTE') as auth_can_count,
  has_function_privilege('authenticated', 'public.upsert_community_live_screen_session(uuid,uuid,text,text,text,text,integer)', 'EXECUTE') as auth_can_upsert,
  has_function_privilege('anon', 'public.upsert_community_live_screen_session(uuid,uuid,text,text,text,text,integer)', 'EXECUTE') as anon_can_upsert;
