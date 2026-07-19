-- Canonical friendship lifecycle, symmetric pending-request protection, and RPC-only writes.
begin;

alter table public.friend_requests
  add column if not exists updated_at timestamptz not null default now();

alter table public.friend_requests
  drop constraint if exists friend_requests_status_check;

alter table public.friend_requests
  add constraint friend_requests_status_check
  check (status in ('pending', 'accepted', 'declined', 'cancelled'));

-- The original directional uniqueness prevented request history. Only one active
-- request may exist for a normalized pair; terminal rows are retained as audit history.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.friend_requests'::regclass
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) like 'UNIQUE (sender_id, recipient_id)%'
  loop
    execute format('alter table public.friend_requests drop constraint %I', constraint_name);
  end loop;
end;
$$;

with ranked_pending as (
  select id,
    row_number() over (
      partition by least(sender_id, recipient_id), greatest(sender_id, recipient_id)
      order by created_at, id
    ) as request_rank
  from public.friend_requests
  where status = 'pending'
)
update public.friend_requests request
set status = 'cancelled', responded_at = coalesce(request.responded_at, now()), updated_at = now()
from ranked_pending ranked
where request.id = ranked.id and ranked.request_rank > 1;

create unique index if not exists friend_requests_one_pending_pair_idx
  on public.friend_requests (
    least(sender_id, recipient_id),
    greatest(sender_id, recipient_id)
  )
  where status = 'pending';

create index if not exists friend_requests_sender_status_idx
  on public.friend_requests(sender_id, status, created_at desc);
create index if not exists friend_requests_recipient_status_idx
  on public.friend_requests(recipient_id, status, created_at desc);
create index if not exists friendships_user_low_idx on public.friendships(user_low_id);
create index if not exists friendships_user_high_idx on public.friendships(user_high_id);

create or replace function public.enforce_friend_request_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('picom.friend_request_archive', true) = 'on' then
    return new;
  end if;

  if new.sender_id = new.recipient_id then
    raise exception 'A user cannot send a friend request to themselves.';
  end if;
  if new.status <> 'pending' then
    raise exception 'New friend requests must start in pending state.';
  end if;
  if auth.uid() is not null and auth.uid() <> new.sender_id then
    raise exception 'Friend request sender must match the authenticated user.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(least(new.sender_id, new.recipient_id)::text || ':' || greatest(new.sender_id, new.recipient_id)::text, 0)
  );

  if public.users_are_blocked(new.sender_id, new.recipient_id) then
    raise exception 'Friend requests are unavailable for this relationship.';
  end if;
  if exists (
    select 1 from public.friendships friendship
    where friendship.user_low_id = least(new.sender_id, new.recipient_id)
      and friendship.user_high_id = greatest(new.sender_id, new.recipient_id)
  ) then
    raise exception 'These users are already friends.';
  end if;
  if exists (
    select 1 from public.friend_requests request
    where request.status = 'pending'
      and least(request.sender_id, request.recipient_id) = least(new.sender_id, new.recipient_id)
      and greatest(request.sender_id, request.recipient_id) = greatest(new.sender_id, new.recipient_id)
  ) then
    raise exception 'A friend request is already pending for this relationship.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists friend_requests_enforce_insert on public.friend_requests;
create trigger friend_requests_enforce_insert
before insert on public.friend_requests
for each row execute function public.enforce_friend_request_insert();

create or replace function public.validate_friend_request_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sender_id <> old.sender_id
     or new.recipient_id <> old.recipient_id
     or new.created_at <> old.created_at then
    raise exception 'Friend request identity fields are immutable.';
  end if;
  if old.status <> 'pending' and new.status <> old.status then
    raise exception 'Terminal friend request states are immutable.';
  end if;
  if old.status = 'pending'
     and new.status not in ('pending', 'accepted', 'declined', 'cancelled') then
    raise exception 'Invalid friend request transition.';
  end if;
  if old.status = 'pending' and new.status <> 'pending' then
    new.responded_at := coalesce(new.responded_at, now());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists friend_requests_validate_transition on public.friend_requests;
create trigger friend_requests_validate_transition
before update on public.friend_requests
for each row execute function public.validate_friend_request_transition();

-- Legacy RPCs cancel/block by DELETE. Preserve their API while converting an
-- active deletion into a canonical cancelled history row and protecting all
-- terminal history from ordinary app flows.
create or replace function public.archive_friend_request_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status <> 'pending' then
    return null;
  end if;

  perform set_config('picom.friend_request_archive', 'on', true);
  insert into public.friend_requests (
    sender_id, recipient_id, status, created_at, responded_at, updated_at
  ) values (
    old.sender_id, old.recipient_id, 'cancelled', old.created_at, now(), now()
  );
  perform set_config('picom.friend_request_archive', 'off', true);
  return old;
end;
$$;

drop trigger if exists friend_requests_archive_delete on public.friend_requests;
create trigger friend_requests_archive_delete
before delete on public.friend_requests
for each row execute function public.archive_friend_request_delete();

alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;

do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'friend_requests'
  loop
    execute format('drop policy %I on public.friend_requests', policy_name);
  end loop;
  for policy_name in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'friendships'
  loop
    execute format('drop policy %I on public.friendships', policy_name);
  end loop;
end;
$$;

create policy friend_requests_participant_read
on public.friend_requests for select to authenticated
using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy friendships_participant_read
on public.friendships for select to authenticated
using (auth.uid() = user_low_id or auth.uid() = user_high_id);

revoke insert, update, delete on public.friend_requests from authenticated;
revoke insert, update, delete on public.friendships from authenticated;
grant select on public.friend_requests, public.friendships to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;

comment on table public.friend_requests is
  'Directional friend requests with pending, accepted, declined, and cancelled history. Writes are RPC-only.';
comment on table public.friendships is
  'Symmetric accepted friendships stored as normalized low/high user pairs. Independent from one-way user_follows.';;
