-- Structural pgTAP contract for the friendship privacy foundation.
begin;
select plan(12);

select has_table('public', 'friend_requests', 'friend_requests exists');
select has_table('public', 'friendships', 'friendships exists');
select has_table('public', 'user_follows', 'one-way follows remain separate from friendships');
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.friend_requests'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%cancelled%'
  ),
  'friend request status accepts the canonical cancelled state'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'friend_requests'
      and indexname = 'friend_requests_one_pending_pair_idx'
      and indexdef like '%UNIQUE%'
      and indexdef like '%status = ''pending''%'
  ),
  'only one symmetric pending request can exist per user pair'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.friend_requests'::regclass
      and tgname = 'friend_requests_validate_transition'
      and not tgisinternal
  ),
  'canonical state transitions are trigger-enforced'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.friend_requests'::regclass
      and tgname = 'friend_requests_archive_delete'
      and not tgisinternal
  ),
  'normal deletes preserve terminal request history'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.friend_requests'::regclass),
  'friend_requests has RLS enabled'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'friend_requests'
      and policyname = 'friend_requests_participant_read'
      and qual like '%sender_id%'
      and qual like '%recipient_id%'
  ),
  'only request participants receive row visibility'
);
select ok(
  not has_table_privilege('authenticated', 'public.friend_requests', 'INSERT')
  and not has_table_privilege('authenticated', 'public.friend_requests', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.friend_requests', 'DELETE'),
  'authenticated writes are restricted to security-definer RPCs'
);
select ok(
  exists (
    select 1 from pg_proc
    where oid = 'public.enforce_friend_request_insert()'::regprocedure
      and prosrc like '%pg_advisory_xact_lock%'
      and prosrc like '%users_are_blocked%'
  ),
  'request creation serializes races and rejects blocked relationships'
);
select ok(
  exists (
    select 1 from pg_proc
    where oid = 'public.can_user_receive_dm(uuid,uuid)'::regprocedure
      and prosrc like '%users_are_blocked%'
  ),
  'the DM access contract also rejects blocked relationships'
);

select * from finish();
rollback;
