-- Structural pgTAP coverage for the server-authoritative friend recommendation boundary.
begin;
select plan(16);

select has_table('public', 'friend_recommendation_exposures', 'exposure state table exists');
select has_table('public', 'friend_recommendation_events', 'feedback event table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.friend_recommendation_exposures'::regclass), 'exposure state has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.friend_recommendation_events'::regclass), 'feedback event state has RLS enabled');
select ok(
  not has_table_privilege('authenticated', 'public.friend_recommendation_exposures', 'SELECT')
  and not has_table_privilege('authenticated', 'public.friend_recommendation_exposures', 'INSERT')
  and not has_table_privilege('authenticated', 'public.friend_recommendation_exposures', 'UPDATE'),
  'authenticated callers cannot enumerate or write exposure state directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.friend_recommendation_events', 'SELECT')
  and not has_table_privilege('authenticated', 'public.friend_recommendation_events', 'INSERT'),
  'authenticated callers cannot enumerate or write feedback events directly'
);
select ok(exists(select 1 from pg_proc where oid = 'public.get_friend_recommendations(integer,text)'::regprocedure and prosecdef), 'recommendation RPC is a hardened definer function');
select ok(exists(select 1 from pg_proc where oid = 'public.get_friend_recommendations(integer,text)'::regprocedure and proconfig::text like '%search_path=public, pg_temp%'), 'recommendation RPC pins search_path');
select ok(exists(select 1 from pg_proc where oid = 'public.get_friend_recommendations(integer,text)'::regprocedure and prosrc like '%auth.uid()%'), 'recommendation RPC derives caller identity from auth.uid');
select ok(exists(select 1 from pg_proc where oid = 'public.get_friend_recommendations(integer,text)'::regprocedure and prosrc like '%can_send_friend_request%' and prosrc like '%users_are_blocked%'), 'recommendation RPC preserves friend-request privacy and mutual block filtering');
select ok(exists(select 1 from pg_proc where oid = 'public.get_friend_recommendations(integer,text)'::regprocedure and prosrc like '%publisher_profile_is_active_account%' and prosrc like '%profile_visibility%'), 'recommendation RPC excludes restricted accounts and respects discoverability');
select ok(exists(select 1 from pg_proc where oid = 'public.get_friend_recommendations(integer,text)'::regprocedure and lower(prosrc) not like '%order by random()%'), 'recommendation RPC does not use random table sorting');
select ok(exists(select 1 from pg_proc where oid = 'public.get_friend_recommendations(integer,text)'::regprocedure and prosrc like '%least(greatest(coalesce(result_limit, 6), 1), 20)%'), 'recommendation RPC clamps the result limit to 1..20');
select ok(has_function_privilege('authenticated', 'public.get_friend_recommendations(integer,text)', 'EXECUTE') and not has_function_privilege('anon', 'public.get_friend_recommendations(integer,text)', 'EXECUTE'), 'only authenticated callers can invoke recommendations');
select ok(exists(select 1 from pg_proc where oid = 'public.dismiss_friend_recommendation(uuid)'::regprocedure and prosrc like '%viewer_user_id = viewer_id%'), 'dismiss RPC is scoped to the authenticated viewer');
select ok(exists(select 1 from pg_proc where oid = 'public.record_friend_recommendation_event(uuid,text)'::regprocedure and prosrc like '%viewer_user_id = viewer_id%'), 'feedback RPC is scoped to the authenticated viewer');

select * from finish();
rollback;
