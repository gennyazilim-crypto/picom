-- User blocking and DM privacy enforcement.
create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_user_id),
  check (blocker_id <> blocked_user_id)
);
create index if not exists idx_blocked_users_blocked on public.blocked_users(blocked_user_id, blocker_id);
grant select, insert, delete on public.blocked_users to authenticated;
alter table public.blocked_users enable row level security;
create policy "blocked_users_select_owner" on public.blocked_users for select to authenticated using (blocker_id = auth.uid());
create policy "blocked_users_insert_owner" on public.blocked_users for insert to authenticated with check (blocker_id = auth.uid());
create policy "blocked_users_delete_owner" on public.blocked_users for delete to authenticated using (blocker_id = auth.uid());

create or replace function public.users_are_blocked(first_user_id uuid, second_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocked_users where (blocker_id = first_user_id and blocked_user_id = second_user_id) or (blocker_id = second_user_id and blocked_user_id = first_user_id));
$$;
grant execute on function public.users_are_blocked(uuid,uuid) to authenticated;

create or replace function public.is_direct_conversation_member(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.direct_conversation_members own where own.conversation_id = target_conversation_id and own.user_id = auth.uid())
    and not exists (
      select 1 from public.direct_conversation_members other
      where other.conversation_id = target_conversation_id and other.user_id <> auth.uid()
        and public.users_are_blocked(auth.uid(), other.user_id)
    );
$$;

create or replace function public.create_direct_conversation(other_user_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_conversation_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if other_user_id is null or other_user_id = auth.uid() then raise exception 'invalid participant'; end if;
  if not exists (select 1 from public.profiles where id = other_user_id) then raise exception 'profile not found'; end if;
  if public.users_are_blocked(auth.uid(), other_user_id) then raise exception 'direct messages blocked'; end if;
  select mine.conversation_id into new_conversation_id
  from public.direct_conversation_members mine join public.direct_conversation_members theirs on theirs.conversation_id = mine.conversation_id
  join public.direct_conversations conversation on conversation.id = mine.conversation_id and conversation.type = 'direct'
  where mine.user_id = auth.uid() and theirs.user_id = other_user_id
    and (select count(*) from public.direct_conversation_members all_members where all_members.conversation_id = mine.conversation_id) = 2 limit 1;
  if new_conversation_id is not null then return new_conversation_id; end if;
  insert into public.direct_conversations(created_by) values (auth.uid()) returning id into new_conversation_id;
  insert into public.direct_conversation_members(conversation_id,user_id) values (new_conversation_id,auth.uid()),(new_conversation_id,other_user_id);
  return new_conversation_id;
end $$;
revoke all on function public.create_direct_conversation(uuid) from public;
grant execute on function public.create_direct_conversation(uuid) to authenticated;
