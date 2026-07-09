begin;
select plan(3);
-- Live fixture coverage is intentionally minimal here; migration policies are exercised in staging account-matrix tests.
select has_table('public','user_follows','user_follows exists');
select has_table('public','friend_requests','friend_requests exists');
select has_table('public','friendships','friendships exists');
select * from finish(); rollback;
