begin;
create table if not exists public.community_member_timeouts (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  timed_out_by uuid references public.profiles(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 500),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
alter table public.community_member_timeouts enable row level security;
revoke all on public.community_member_timeouts from authenticated;
create or replace function public.moderate_community_member(target_community_id uuid, target_user_id uuid, moderation_action text, moderation_reason text, timeout_minutes integer default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare community_owner uuid; actor_level integer; target_level integer; timeout_until timestamptz;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if moderation_action not in ('kick', 'ban', 'timeout') then raise exception 'VALIDATION_ERROR'; end if;
  if char_length(trim(moderation_reason)) < 3 or char_length(trim(moderation_reason)) > 500 then raise exception 'VALIDATION_ERROR'; end if;
  select owner_id into community_owner from public.communities where id = target_community_id;
  if community_owner is null then raise exception 'COMMUNITY_NOT_FOUND'; end if;
  if target_user_id = auth.uid() then raise exception 'PERMISSION_DENIED'; end if;

  if auth.uid() = community_owner then actor_level := 100;
  else select r.level into actor_level from public.community_members cm join public.roles r on r.id = cm.role_id where cm.community_id = target_community_id and cm.user_id = auth.uid(); end if;
  select case when target_user_id = community_owner then 100 else r.level end into target_level from public.community_members cm join public.roles r on r.id = cm.role_id where cm.community_id = target_community_id and cm.user_id = target_user_id;
  if actor_level is null or actor_level < 60 then raise exception 'PERMISSION_DENIED'; end if;
  if target_level is null then raise exception 'MEMBER_NOT_FOUND'; end if;
  if target_level >= 100 then raise exception 'OWNER_PROTECTED'; end if;
  if actor_level <= target_level then raise exception 'ROLE_HIERARCHY_DENIED'; end if;

  if moderation_action = 'timeout' then
    if timeout_minutes is null or timeout_minutes < 1 or timeout_minutes > 10080 then raise exception 'VALIDATION_ERROR'; end if;
    timeout_until := now() + make_interval(mins => timeout_minutes);
    insert into public.community_member_timeouts (community_id, user_id, timed_out_by, reason, expires_at)
    values (target_community_id, target_user_id, auth.uid(), trim(moderation_reason), timeout_until)
    on conflict (community_id, user_id) do update set timed_out_by = excluded.timed_out_by, reason = excluded.reason, expires_at = excluded.expires_at, created_at = now();
  elsif moderation_action = 'ban' then
    insert into public.community_bans (community_id, user_id, banned_by, reason, revoked_at)
    values (target_community_id, target_user_id, auth.uid(), trim(moderation_reason), null)
    on conflict (community_id, user_id) do update set banned_by = excluded.banned_by, reason = excluded.reason, revoked_at = null, created_at = now();
    delete from public.community_members where community_id = target_community_id and user_id = target_user_id;
  else
    delete from public.community_members where community_id = target_community_id and user_id = target_user_id;
  end if;

  insert into public.moderation_action_records (community_id, affected_user_id, actor_id, action_type, target_id, reason_code, appealable, appealable_until)
  values (target_community_id, target_user_id, auth.uid(), moderation_action, target_user_id, left(regexp_replace(lower(trim(moderation_reason)), '[^a-z0-9_-]+', '-', 'g'), 80), true, now() + interval '30 days');
  return jsonb_build_object('action', moderation_action, 'targetUserId', target_user_id, 'timeoutUntil', timeout_until);
end;
$$;
revoke all on function public.moderate_community_member(uuid, uuid, text, text, integer) from public;
grant execute on function public.moderate_community_member(uuid, uuid, text, text, integer) to authenticated;
commit;
