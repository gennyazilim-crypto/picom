-- Task 563: one active screen-share lease per meeting room. No screen media is stored.
begin;

create table if not exists public.meeting_screen_share_leases (
  room_id uuid primary key references public.meeting_rooms(id) on delete cascade,
  session_id uuid not null references public.meeting_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  check (expires_at > acquired_at)
);

create index if not exists meeting_screen_share_leases_session_idx on public.meeting_screen_share_leases(session_id);
alter table public.meeting_screen_share_leases enable row level security;

drop policy if exists meeting_screen_share_leases_select_visible on public.meeting_screen_share_leases;
create policy meeting_screen_share_leases_select_visible on public.meeting_screen_share_leases for select to authenticated
using (public.can_view_meeting_room(room_id));

create or replace function public.claim_meeting_screen_share(target_room_id uuid,target_session_id uuid,target_lease_seconds integer default 7200)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare active_lease public.meeting_screen_share_leases%rowtype; participant_record public.meeting_session_participants%rowtype;
begin
  if auth.uid() is null then raise exception 'MEETING_AUTH_REQUIRED' using errcode='42501'; end if;
  if target_lease_seconds not between 60 and 14400 then raise exception 'MEETING_SCREEN_SHARE_LEASE_INVALID' using errcode='22023'; end if;
  perform public.authorize_meeting_action(target_room_id,'share_screen');
  select participant.* into participant_record from public.meeting_session_participants participant
  join public.meeting_sessions session on session.id=participant.session_id
  where participant.session_id=target_session_id and session.room_id=target_room_id and participant.user_id=auth.uid()
    and participant.state in ('connected','reconnecting') and coalesce(participant.screen_share_allowed,true)
    and coalesce((participant.capabilities->>'canShareScreen')::boolean,true)
  order by participant.updated_at desc limit 1;
  if participant_record.id is null then raise exception 'MEETING_SCREEN_SHARE_PARTICIPANT_FORBIDDEN' using errcode='42501'; end if;
  select * into active_lease from public.meeting_screen_share_leases where room_id=target_room_id for update;
  if active_lease.room_id is not null and active_lease.expires_at>now() and active_lease.user_id<>auth.uid() then
    raise exception 'MEETING_SCREEN_SHARE_CONFLICT' using errcode='55000';
  end if;
  insert into public.meeting_screen_share_leases(room_id,session_id,user_id,acquired_at,expires_at,updated_at)
  values(target_room_id,target_session_id,auth.uid(),now(),now()+make_interval(secs=>target_lease_seconds),now())
  on conflict(room_id) do update set session_id=excluded.session_id,user_id=excluded.user_id,acquired_at=excluded.acquired_at,expires_at=excluded.expires_at,updated_at=now();
  return jsonb_build_object('roomId',target_room_id,'sessionId',target_session_id,'claimed',true,'expiresAt',now()+make_interval(secs=>target_lease_seconds));
end;
$$;

create or replace function public.release_meeting_screen_share(target_room_id uuid,target_session_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare active_lease public.meeting_screen_share_leases%rowtype;
begin
  if auth.uid() is null then raise exception 'MEETING_AUTH_REQUIRED' using errcode='42501'; end if;
  select * into active_lease from public.meeting_screen_share_leases where room_id=target_room_id for update;
  if active_lease.room_id is null then return true; end if;
  if active_lease.session_id<>target_session_id then return false; end if;
  if active_lease.user_id<>auth.uid() then perform public.authorize_meeting_action(target_room_id,'manage'); end if;
  delete from public.meeting_screen_share_leases where room_id=target_room_id and session_id=target_session_id;
  return true;
end;
$$;

create or replace function public.cleanup_meeting_screen_share_lease()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_table_name='meeting_sessions' then
    if tg_op='DELETE' then delete from public.meeting_screen_share_leases where session_id=old.id;
    elsif new.status in ('ended','failed') then delete from public.meeting_screen_share_leases where session_id=new.id;
    end if;
  elsif tg_op='DELETE' then
    delete from public.meeting_screen_share_leases where session_id=old.session_id and user_id=old.user_id;
  elsif new.state in ('left','removed') then
    delete from public.meeting_screen_share_leases where session_id=new.session_id and user_id=new.user_id;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_cleanup_meeting_session_screen_share on public.meeting_sessions;
create trigger trg_cleanup_meeting_session_screen_share after update of status or delete on public.meeting_sessions for each row execute function public.cleanup_meeting_screen_share_lease();
drop trigger if exists trg_cleanup_meeting_participant_screen_share on public.meeting_session_participants;
create trigger trg_cleanup_meeting_participant_screen_share after update of state or delete on public.meeting_session_participants for each row execute function public.cleanup_meeting_screen_share_lease();

revoke all on table public.meeting_screen_share_leases from public,anon;
grant select on table public.meeting_screen_share_leases to authenticated;
revoke all on function public.claim_meeting_screen_share(uuid,uuid,integer),public.release_meeting_screen_share(uuid,uuid),public.cleanup_meeting_screen_share_lease() from public,anon;
grant execute on function public.claim_meeting_screen_share(uuid,uuid,integer),public.release_meeting_screen_share(uuid,uuid) to authenticated;

comment on table public.meeting_screen_share_leases is 'Ephemeral ownership metadata only; no captured screen media is stored.';
commit;
