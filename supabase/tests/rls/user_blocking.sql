begin;
select plan(2);
select has_table('public','blocked_users','blocked_users exists');
select has_function('public','users_are_blocked',array['uuid','uuid'],'block check helper exists');
select * from finish(); rollback;
