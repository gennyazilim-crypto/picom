-- Follow and friend relationship foundation.
create table if not exists public.user_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, followed_id),
  check (follower_id <> followed_id)
);
create index if not exists idx_user_follows_followed on public.user_follows(followed_id, created_at desc);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (sender_id, recipient_id),
  check (sender_id <> recipient_id)
);
create index if not exists idx_friend_requests_recipient_status on public.friend_requests(recipient_id, status, created_at desc);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid not null references public.profiles(id) on delete cascade,
  user_high_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_low_id, user_high_id),
  check (user_low_id < user_high_id)
);
create index if not exists idx_friendships_low on public.friendships(user_low_id);
create index if not exists idx_friendships_high on public.friendships(user_high_id);

grant select, insert, delete on public.user_follows to authenticated;
grant select, insert, update, delete on public.friend_requests to authenticated;
grant select, delete on public.friendships to authenticated;
alter table public.user_follows enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;

create policy "follows_select_authenticated" on public.user_follows for select to authenticated using (true);
create policy "follows_insert_self" on public.user_follows for insert to authenticated with check (follower_id = auth.uid());
create policy "follows_delete_self" on public.user_follows for delete to authenticated using (follower_id = auth.uid());

create policy "friend_requests_select_participants" on public.friend_requests for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "friend_requests_insert_sender" on public.friend_requests for insert to authenticated with check (sender_id = auth.uid() and status = 'pending');
create policy "friend_requests_update_recipient" on public.friend_requests for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy "friend_requests_delete_sender_pending" on public.friend_requests for delete to authenticated using (sender_id = auth.uid() and status = 'pending');
create policy "friendships_select_participants" on public.friendships for select to authenticated using (user_low_id = auth.uid() or user_high_id = auth.uid());
create policy "friendships_delete_participants" on public.friendships for delete to authenticated using (user_low_id = auth.uid() or user_high_id = auth.uid());

create or replace function public.respond_friend_request(target_request_id uuid, accept_request boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare request_row public.friend_requests%rowtype;
begin
  select * into request_row from public.friend_requests where id = target_request_id and recipient_id = auth.uid() and status = 'pending' for update;
  if request_row.id is null then return false; end if;
  update public.friend_requests set status = case when accept_request then 'accepted' else 'declined' end, responded_at = now() where id = target_request_id;
  if accept_request then
    insert into public.friendships(user_low_id,user_high_id) values (least(request_row.sender_id,request_row.recipient_id),greatest(request_row.sender_id,request_row.recipient_id)) on conflict do nothing;
  end if;
  return true;
end $$;

create or replace function public.remove_friend(other_user_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare removed_count integer;
begin
  delete from public.friendships where user_low_id = least(auth.uid(), other_user_id) and user_high_id = greatest(auth.uid(), other_user_id);
  get diagnostics removed_count = row_count;
  return removed_count > 0;
end $$;
revoke all on function public.respond_friend_request(uuid,boolean), public.remove_friend(uuid) from public;
grant execute on function public.respond_friend_request(uuid,boolean), public.remove_friend(uuid) to authenticated;
