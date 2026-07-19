create or replace function public.block_user(target_user_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if target_user_id is null or target_user_id=auth.uid() then raise exception 'BLOCK_TARGET_INVALID' using errcode='22023'; end if;
  if not exists(select 1 from public.profiles where id=target_user_id) then raise exception 'PROFILE_NOT_FOUND' using errcode='P0002'; end if;
  insert into public.blocked_users(blocker_id,blocked_user_id) values(auth.uid(),target_user_id) on conflict(blocker_id,blocked_user_id) do nothing;
  delete from public.friendships where user_low_id=least(auth.uid(),target_user_id) and user_high_id=greatest(auth.uid(),target_user_id);
  delete from public.friend_requests where (sender_id=auth.uid() and recipient_id=target_user_id) or (sender_id=target_user_id and recipient_id=auth.uid());
  delete from public.user_follows where (follower_id=auth.uid() and followed_id=target_user_id) or (follower_id=target_user_id and followed_id=auth.uid());
  return true;
end $$;
create or replace function public.unblock_user(target_user_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare removed_count integer; begin
  delete from public.blocked_users where blocker_id=auth.uid() and blocked_user_id=target_user_id;
  get diagnostics removed_count=row_count;
  return removed_count>0;
end $$;
create or replace function public.list_blocked_users() returns table(user_id uuid,display_name text,username text,blocked_at timestamptz) language sql stable security definer set search_path=public as $$
  select profile.id,profile.display_name,profile.username,blocked.created_at from public.blocked_users blocked join public.profiles profile on profile.id=blocked.blocked_user_id where blocked.blocker_id=auth.uid() order by blocked.created_at desc;
$$;
revoke insert,delete on public.blocked_users from authenticated;
revoke all on function public.block_user(uuid),public.unblock_user(uuid),public.list_blocked_users() from public,anon;
grant execute on function public.block_user(uuid),public.unblock_user(uuid),public.list_blocked_users() to authenticated;
drop trigger if exists blocked_users_user_rate_limit on public.blocked_users;
create trigger blocked_users_user_rate_limit before insert or delete on public.blocked_users for each row execute function public.enforce_current_user_action_rate_limit('relationship_write');
comment on function public.block_user(uuid) is 'Atomically blocks a user and removes relationship edges. Never records message content, credentials, tokens, or raw IP data.';
