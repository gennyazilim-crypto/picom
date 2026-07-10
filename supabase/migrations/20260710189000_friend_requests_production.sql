alter table public.profiles add column if not exists friend_request_privacy text not null default 'community_members' check(friend_request_privacy in ('everyone','community_members','friends_of_friends','nobody'));

create table if not exists public.friend_request_notifications (
  id uuid primary key default gen_random_uuid(), recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade, request_id uuid references public.friend_requests(id) on delete set null,
  event_type text not null check(event_type in ('request_sent','request_accepted')), created_at timestamptz not null default now(), read_at timestamptz
);
create index if not exists idx_friend_request_notifications_recipient_created on public.friend_request_notifications(recipient_id,created_at desc);
alter table public.friend_request_notifications enable row level security;
revoke all on public.friend_request_notifications from anon,authenticated;
grant select,update(read_at) on public.friend_request_notifications to authenticated;
create policy "friend_notifications_recipient_select" on public.friend_request_notifications for select to authenticated using(recipient_id=auth.uid());
create policy "friend_notifications_recipient_read" on public.friend_request_notifications for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
comment on table public.friend_request_notifications is 'Safe relationship notification metadata only; never stores message content, credentials, tokens, IP addresses, or private profile content.';

create or replace function public.are_friends(first_user_id uuid,second_user_id uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.friendships friendship where friendship.user_low_id=least(first_user_id,second_user_id) and friendship.user_high_id=greatest(first_user_id,second_user_id));
$$;

create or replace function public.can_send_friend_request(sender_id uuid,recipient_id uuid) returns boolean language sql stable security definer set search_path=public as $$
  select sender_id is not null and recipient_id is not null and sender_id<>recipient_id
    and not public.users_are_blocked(sender_id,recipient_id)
    and not public.are_friends(sender_id,recipient_id)
    and exists(select 1 from public.profiles recipient where recipient.id=recipient_id and (
      recipient.friend_request_privacy='everyone'
      or (recipient.friend_request_privacy='community_members' and exists(select 1 from public.community_members sender_member join public.community_members recipient_member on recipient_member.community_id=sender_member.community_id where sender_member.user_id=sender_id and recipient_member.user_id=recipient_id))
      or (recipient.friend_request_privacy='friends_of_friends' and exists(select 1 from public.friendships first_link join public.friendships second_link on (case when first_link.user_low_id=sender_id then first_link.user_high_id else first_link.user_low_id end)=(case when second_link.user_low_id=recipient_id then second_link.user_high_id else second_link.user_low_id end) where sender_id in(first_link.user_low_id,first_link.user_high_id) and recipient_id in(second_link.user_low_id,second_link.user_high_id)))
    ));
$$;

create or replace function public.send_friend_request(target_user_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare existing_request public.friend_requests%rowtype; new_request_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if public.are_friends(auth.uid(),target_user_id) then raise exception 'ALREADY_FRIENDS' using errcode='23505'; end if;
  if public.users_are_blocked(auth.uid(),target_user_id) then raise exception 'FRIEND_REQUEST_BLOCKED' using errcode='42501'; end if;
  if not public.can_send_friend_request(auth.uid(),target_user_id) then raise exception 'FRIEND_REQUEST_PRIVACY' using errcode='42501'; end if;
  select * into existing_request from public.friend_requests where (sender_id=auth.uid() and recipient_id=target_user_id) or (sender_id=target_user_id and recipient_id=auth.uid()) order by created_at desc limit 1 for update;
  if existing_request.status='pending' then raise exception 'FRIEND_REQUEST_EXISTS' using errcode='23505'; end if;
  if existing_request.id is not null and existing_request.created_at>now()-interval '24 hours' then raise exception 'FRIEND_REQUEST_COOLDOWN' using errcode='P0001'; end if;
  delete from public.friend_requests where (sender_id=auth.uid() and recipient_id=target_user_id) or (sender_id=target_user_id and recipient_id=auth.uid());
  insert into public.friend_requests(sender_id,recipient_id,status) values(auth.uid(),target_user_id,'pending') returning id into new_request_id;
  insert into public.friend_request_notifications(recipient_id,actor_id,request_id,event_type) values(target_user_id,auth.uid(),new_request_id,'request_sent');
  return new_request_id;
end $$;

create or replace function public.respond_friend_request(target_request_id uuid,accept_request boolean) returns boolean language plpgsql security definer set search_path=public as $$
declare request_row public.friend_requests%rowtype;
begin
  select * into request_row from public.friend_requests where id=target_request_id and recipient_id=auth.uid() and status='pending' for update;
  if request_row.id is null then return false; end if;
  if public.users_are_blocked(request_row.sender_id,request_row.recipient_id) then raise exception 'FRIEND_REQUEST_BLOCKED' using errcode='42501'; end if;
  update public.friend_requests set status=case when accept_request then 'accepted' else 'declined' end,responded_at=now() where id=target_request_id;
  if accept_request then
    insert into public.friendships(user_low_id,user_high_id) values(least(request_row.sender_id,request_row.recipient_id),greatest(request_row.sender_id,request_row.recipient_id)) on conflict do nothing;
    insert into public.friend_request_notifications(recipient_id,actor_id,request_id,event_type) values(request_row.sender_id,auth.uid(),request_row.id,'request_accepted');
  end if;
  return true;
end $$;

create or replace function public.cancel_friend_request(target_request_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare removed_count integer; begin delete from public.friend_requests where id=target_request_id and sender_id=auth.uid() and status='pending'; get diagnostics removed_count=row_count; return removed_count>0; end $$;

create or replace function public.remove_friend(other_user_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare removed_count integer; begin
  delete from public.friendships where user_low_id=least(auth.uid(),other_user_id) and user_high_id=greatest(auth.uid(),other_user_id); get diagnostics removed_count=row_count;
  delete from public.friend_requests where (sender_id=auth.uid() and recipient_id=other_user_id) or (sender_id=other_user_id and recipient_id=auth.uid());
  return removed_count>0;
end $$;

create or replace function public.list_friend_relationship_state() returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'friends',coalesce((select jsonb_agg(jsonb_build_object('id',friendship.id,'userId',profile.id,'displayName',profile.display_name,'username',profile.username,'avatarUrl',profile.avatar_url,'status',profile.status,'statusText',profile.status_text,'mutualCommunityCount',(select count(distinct mine.community_id) from public.community_members mine join public.community_members theirs on theirs.community_id=mine.community_id where mine.user_id=auth.uid() and theirs.user_id=profile.id))) from public.friendships friendship join public.profiles profile on profile.id=case when friendship.user_low_id=auth.uid() then friendship.user_high_id else friendship.user_low_id end where auth.uid() in(friendship.user_low_id,friendship.user_high_id)),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(jsonb_build_object('id',request.id,'userId',profile.id,'displayName',profile.display_name,'username',profile.username,'avatarUrl',profile.avatar_url,'direction',case when request.recipient_id=auth.uid() then 'incoming' else 'outgoing' end,'createdAt',request.created_at) order by request.created_at desc) from public.friend_requests request join public.profiles profile on profile.id=case when request.recipient_id=auth.uid() then request.sender_id else request.recipient_id end where request.status='pending' and auth.uid() in(request.sender_id,request.recipient_id)),'[]'::jsonb)
  );
$$;

revoke insert,update,delete on public.friend_requests from authenticated;
revoke delete on public.friendships from authenticated;
revoke all on function public.are_friends(uuid,uuid),public.can_send_friend_request(uuid,uuid),public.send_friend_request(uuid),public.cancel_friend_request(uuid),public.respond_friend_request(uuid,boolean),public.remove_friend(uuid),public.list_friend_relationship_state() from public,anon;
grant execute on function public.send_friend_request(uuid),public.cancel_friend_request(uuid),public.respond_friend_request(uuid,boolean),public.remove_friend(uuid),public.list_friend_relationship_state() to authenticated;

do $$ begin if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='friend_request_notifications') then alter publication supabase_realtime add table public.friend_request_notifications; end if; end $$;
