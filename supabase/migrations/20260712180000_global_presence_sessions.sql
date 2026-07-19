-- Multi-session global presence aggregation for the authenticated desktop shell.
begin;
create table if not exists public.user_presence_sessions (
  session_id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('online','idle','dnd')),
  share_presence boolean not null default true,
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '100 seconds'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_presence_sessions_user_expiry_idx on public.user_presence_sessions(user_id,expires_at desc);
alter table public.user_presence_sessions enable row level security;
drop policy if exists user_presence_sessions_self_read on public.user_presence_sessions;
create policy user_presence_sessions_self_read on public.user_presence_sessions
for select to authenticated using (user_id=auth.uid());
revoke insert,update,delete on public.user_presence_sessions from authenticated;
grant select on public.user_presence_sessions to authenticated;
create or replace function public.refresh_my_aggregated_presence()
returns void language plpgsql security definer set search_path=public as $$
declare
  viewer_id uuid := auth.uid();
  aggregate_status text;
  aggregate_share boolean;
begin
  if viewer_id is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  delete from public.user_presence_sessions where expires_at<=now();
  select
    coalesce((array_agg(session.status order by case session.status when 'dnd' then 1 when 'online' then 2 else 3 end))[1],'offline'),
    coalesce(bool_or(session.share_presence),false)
  into aggregate_status,aggregate_share
  from public.user_presence_sessions session
  where session.user_id=viewer_id and session.expires_at>now();

  insert into public.friend_presence(user_id,status,share_presence,last_seen_at,updated_at)
  values(viewer_id,aggregate_status,aggregate_share,now(),now())
  on conflict(user_id) do update set status=excluded.status,share_presence=excluded.share_presence,last_seen_at=excluded.last_seen_at,updated_at=excluded.updated_at;
end;
$$;
create or replace function public.set_my_presence_session(target_session_id uuid,target_status text,share_presence boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if target_session_id is null then raise exception 'SESSION_REQUIRED' using errcode='22023'; end if;
  if target_status not in ('online','idle','dnd') then raise exception 'INVALID_PRESENCE_STATUS' using errcode='22023'; end if;
  insert into public.user_presence_sessions(session_id,user_id,status,share_presence,last_seen_at,expires_at,updated_at)
  values(target_session_id,auth.uid(),target_status,share_presence,now(),now()+interval '100 seconds',now())
  on conflict(session_id) do update set status=excluded.status,share_presence=excluded.share_presence,last_seen_at=excluded.last_seen_at,expires_at=excluded.expires_at,updated_at=excluded.updated_at
  where user_presence_sessions.user_id=auth.uid();
  perform public.refresh_my_aggregated_presence();
end;
$$;
create or replace function public.clear_my_presence_session(target_session_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  delete from public.user_presence_sessions where session_id=target_session_id and user_id=auth.uid();
  perform public.refresh_my_aggregated_presence();
end;
$$;
revoke all on function public.refresh_my_aggregated_presence() from public,authenticated;
grant execute on function public.set_my_presence_session(uuid,text,boolean) to authenticated;
grant execute on function public.clear_my_presence_session(uuid) to authenticated;
comment on table public.user_presence_sessions is 'Private expiring desktop presence sessions aggregated into friend_presence.';
comment on function public.set_my_presence_session(uuid,text,boolean) is 'Authenticated heartbeat for one desktop session; invisible sessions publish share_presence=false.';
commit;
