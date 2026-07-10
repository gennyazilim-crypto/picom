-- Idempotent, privacy-aware follow mutation boundary.

create or replace function public.follow_user(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if target_user_id is null or target_user_id = auth.uid() then raise exception 'FOLLOW_TARGET_INVALID' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = target_user_id) then raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002'; end if;
  if public.users_are_blocked(auth.uid(), target_user_id) then raise exception 'FOLLOW_BLOCKED' using errcode = '42501'; end if;
  if not public.can_view_profile(target_user_id) then raise exception 'PROFILE_NOT_VISIBLE' using errcode = '42501'; end if;
  if exists (select 1 from public.user_follows where follower_id = auth.uid() and followed_id = target_user_id) then return true; end if;

  insert into public.user_follows(follower_id, followed_id) values(auth.uid(), target_user_id);
  return true;
end;
$$;

create or replace function public.unfollow_user(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if target_user_id is null or target_user_id = auth.uid() then raise exception 'FOLLOW_TARGET_INVALID' using errcode = '22023'; end if;
  delete from public.user_follows where follower_id = auth.uid() and followed_id = target_user_id;
  return true;
end;
$$;

revoke insert, update, delete on public.user_follows from authenticated;
revoke all on function public.follow_user(uuid), public.unfollow_user(uuid) from public, anon;
grant execute on function public.follow_user(uuid), public.unfollow_user(uuid) to authenticated;

alter table public.user_follows replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_follows'
  ) then
    alter publication supabase_realtime add table public.user_follows;
  end if;
end $$;

comment on function public.follow_user(uuid) is
  'Idempotent follow mutation for a visible, unblocked profile. The existing relationship-write trigger rate-limits new rows.';
comment on function public.unfollow_user(uuid) is
  'Idempotent current-user unfollow mutation. No target relationship details are exposed.';
