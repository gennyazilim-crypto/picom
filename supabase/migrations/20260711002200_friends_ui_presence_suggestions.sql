-- Privacy-aware friend presence and mutual-context suggestions.
begin;

create table if not exists public.friend_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'offline' check (status in ('online','idle','dnd','offline')),
  share_presence boolean not null default true,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists friend_presence_last_seen_idx on public.friend_presence(last_seen_at desc);
alter table public.friend_presence enable row level security;
alter table public.friend_presence replica identity full;

drop policy if exists friend_presence_self_or_friend_read on public.friend_presence;
create policy friend_presence_self_or_friend_read
on public.friend_presence for select to authenticated
using (
  user_id = auth.uid()
  or (
    share_presence
    and exists (
      select 1 from public.friendships friendship
      where friendship.user_low_id = least(auth.uid(), friend_presence.user_id)
        and friendship.user_high_id = greatest(auth.uid(), friend_presence.user_id)
    )
  )
);

revoke insert, update, delete on public.friend_presence from authenticated;
grant select on public.friend_presence to authenticated;

create or replace function public.set_my_friend_presence(target_status text, share_presence boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if target_status not in ('online','idle','dnd','offline') then raise exception 'INVALID_PRESENCE_STATUS' using errcode='22023'; end if;
  insert into public.friend_presence(user_id,status,share_presence,last_seen_at,updated_at)
  values(auth.uid(),target_status,share_presence,now(),now())
  on conflict(user_id) do update set status=excluded.status,share_presence=excluded.share_presence,last_seen_at=excluded.last_seen_at,updated_at=excluded.updated_at;
end;
$$;

create or replace function public.list_friend_presence(target_user_ids uuid[])
returns table(user_id uuid,status text,status_text text,last_seen_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select target.user_id,
    case when presence.share_presence and presence.last_seen_at > now()-interval '100 seconds' then presence.status else 'offline' end,
    case
      when not coalesce(presence.share_presence,false) or presence.last_seen_at <= now()-interval '100 seconds' then 'Offline'
      when presence.status='online' then 'Online'
      when presence.status='idle' then 'Idle'
      when presence.status='dnd' then 'Busy'
      else 'Offline'
    end,
    presence.last_seen_at
  from unnest(coalesce(target_user_ids,array[]::uuid[])) target(user_id)
  left join public.friend_presence presence on presence.user_id=target.user_id
  where auth.uid() is not null
    and public.are_friends(auth.uid(),target.user_id);
$$;

create or replace function public.list_friend_suggestions(result_limit integer default 12)
returns table(user_id uuid,display_name text,username text,avatar_url text,mutual_community_count bigint,followed_by_current_user boolean)
language sql
stable
security definer
set search_path = public
as $$
  with viewer_communities as (
    select community_id from public.community_members where user_id=auth.uid()
  ), candidate_counts as (
    select member.user_id,count(distinct member.community_id)::bigint mutual_count
    from public.community_members member
    join viewer_communities viewer on viewer.community_id=member.community_id
    where member.user_id<>auth.uid()
    group by member.user_id
  )
  select profile.id,profile.display_name,profile.username,profile.avatar_url,candidate.mutual_count,
    exists(select 1 from public.user_follows follow where follow.follower_id=auth.uid() and follow.followed_id=profile.id)
  from candidate_counts candidate
  join public.profiles profile on profile.id=candidate.user_id
  where auth.uid() is not null
    and public.can_send_friend_request(auth.uid(),profile.id)
    and not exists(
      select 1 from public.friend_requests request
      where request.status='pending'
        and least(request.sender_id,request.recipient_id)=least(auth.uid(),profile.id)
        and greatest(request.sender_id,request.recipient_id)=greatest(auth.uid(),profile.id)
    )
  order by exists(select 1 from public.user_follows follow where follow.follower_id=auth.uid() and follow.followed_id=profile.id) desc,
    candidate.mutual_count desc,profile.display_name
  limit greatest(1,least(coalesce(result_limit,12),24));
$$;

grant execute on function public.set_my_friend_presence(text,boolean) to authenticated;
grant execute on function public.list_friend_presence(uuid[]) to authenticated;
grant execute on function public.list_friend_suggestions(integer) to authenticated;

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='friend_presence') then
    alter publication supabase_realtime add table public.friend_presence;
  end if;
end;
$$;

comment on table public.friend_presence is 'Minimal friend-only presence heartbeat. Custom status text is never published.';
comment on function public.list_friend_suggestions(integer) is 'Privacy-aware suggestions derived from shared communities and optional follow signal.';

commit;
