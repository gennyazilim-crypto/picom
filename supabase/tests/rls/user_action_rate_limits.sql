-- Structural checks for Task 125. Run only in disposable local/staging Supabase.
begin;
select plan(10);
select has_table('public','user_action_rate_limits','user action rate-limit table exists');
select has_function('public','consume_current_user_action_rate_limit',array['text'],'fixed action limiter exists');
select has_function('public','enforce_current_user_action_rate_limit','trigger limiter exists');
select has_trigger('public','messages','messages_user_rate_limit','message trigger exists');
select has_trigger('public','attachments','attachments_user_rate_limit','attachment trigger exists');
select has_trigger('public','message_reactions','message_reactions_user_rate_limit','reaction trigger exists');
select has_trigger('public','user_follows','user_follows_user_rate_limit','follow trigger exists');
select has_trigger('public','friend_requests','friend_requests_user_rate_limit','friend request trigger exists');
select has_trigger('public','saved_messages','saved_messages_user_rate_limit','saved feed trigger exists');
select table_privs_are('public','user_action_rate_limits','authenticated',array[]::text[],'authenticated cannot read or mutate limiter counters');
select * from finish();
rollback;

-- Behavioral staging cases: threshold+1 concurrent requests, independent second
-- user, window reset, direct REST bypass resistance, LiveKit safe 429/Retry-After,
-- and no credentials/content in counters or logs.

