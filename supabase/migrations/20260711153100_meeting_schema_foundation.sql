-- Task 531: durable meeting metadata foundation. Raw audio/video/screen media is never stored here.
begin;

create table if not exists public.meeting_rooms (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete set null,
  event_id uuid references public.community_events(id) on delete set null,
  linked_chat_channel_id uuid references public.channels(id) on delete set null,
  source_kind text not null check (source_kind in ('community_channel','scheduled_event','ad_hoc')),
  mode text not null check (mode in ('voice','meeting','stage')),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  status text not null default 'scheduled' check (status in ('scheduled','open','live','ended','cancelled','locked')),
  join_policy text not null default 'members' check (join_policy in ('open','members','invite_only','approval_required')),
  default_role text not null default 'participant' check (default_role in ('host','cohost','speaker','participant','viewer','guest')),
  host_user_id uuid not null references public.profiles(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  approved_by_user_id uuid references public.profiles(id) on delete restrict,
  capabilities jsonb not null default '{}'::jsonb check (jsonb_typeof(capabilities) = 'object'),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and not metadata ?| array['raw_audio','raw_video','raw_screen','media_blob','recording','access_token','refresh_token','livekit_token']
  ),
  waiting_room_enabled boolean not null default false,
  max_participants integer not null default 50 check (max_participants between 2 and 1000),
  scheduled_for timestamptz,
  scheduled_end_at timestamptz,
  locked_at timestamptz,
  locked_by_user_id uuid references public.profiles(id) on delete set null,
  ended_at timestamptz,
  ended_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end_at is null or scheduled_for is null or scheduled_end_at > scheduled_for),
  check (
    (source_kind = 'community_channel' and channel_id is not null and event_id is null)
    or (source_kind = 'scheduled_event' and event_id is not null)
    or (source_kind = 'ad_hoc' and event_id is null and approved_by_user_id is not null)
  ),
  check ((status = 'locked') = (locked_at is not null) or status <> 'locked'),
  check ((status = 'ended') = (ended_at is not null) or status <> 'ended')
);

create table if not exists public.meeting_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.meeting_rooms(id) on delete cascade,
  provider text not null default 'livekit' check (provider = 'livekit'),
  provider_room_name text not null check (char_length(provider_room_name) between 1 and 180),
  status text not null default 'preparing' check (status in ('preparing','live','reconnecting','ended','failed')),
  connection_state text not null default 'idle' check (connection_state in ('idle','requesting_token','connecting','connected','reconnecting','permission_denied','token_error','error','disconnected','waiting_room','admitted','ending')),
  started_by_user_id uuid not null references public.profiles(id) on delete restrict,
  ended_by_user_id uuid references public.profiles(id) on delete set null,
  started_at timestamptz,
  ended_at timestamptz,
  participant_count integer not null default 0 check (participant_count between 0 and 1000),
  last_event_sequence bigint not null default 0 check (last_event_sequence >= 0),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 160),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and not metadata ?| array['raw_audio','raw_video','raw_screen','media_blob','recording','access_token','refresh_token','livekit_token']
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_room_name),
  unique (room_id, idempotency_key),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

create table if not exists public.meeting_session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.meeting_sessions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  provider_identity text not null check (char_length(provider_identity) between 1 and 180),
  display_name text not null check (char_length(display_name) between 1 and 120),
  role text not null check (role in ('host','cohost','speaker','participant','viewer','guest')),
  state text not null default 'joining' check (state in ('invited','waiting','joining','connected','reconnecting','left','removed')),
  capabilities jsonb not null default '{}'::jsonb check (jsonb_typeof(capabilities) = 'object'),
  joined_at timestamptz,
  left_at timestamptz,
  last_seen_at timestamptz,
  removed_by_user_id uuid references public.profiles(id) on delete set null,
  removal_reason_code text check (removal_reason_code is null or char_length(removal_reason_code) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, provider_identity),
  check (left_at is null or joined_at is null or left_at >= joined_at)
);

create table if not exists public.meeting_waiting_entries (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.meeting_rooms(id) on delete cascade,
  session_id uuid references public.meeting_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  requested_role text not null default 'guest' check (requested_role in ('host','cohost','speaker','participant','viewer','guest')),
  status text not null default 'waiting' check (status in ('waiting','admitted','denied','expired','cancelled')),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 160),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid references public.profiles(id) on delete set null,
  denial_reason_code text check (denial_reason_code is null or denial_reason_code in ('room_locked','not_invited','capacity','host_denied','policy')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, idempotency_key)
);

create table if not exists public.meeting_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.meeting_rooms(id) on delete cascade,
  invited_user_id uuid references public.profiles(id) on delete cascade,
  invited_by_user_id uuid not null references public.profiles(id) on delete restrict,
  role text not null default 'participant' check (role in ('host','cohost','speaker','participant','viewer','guest')),
  status text not null default 'active' check (status in ('active','accepted','declined','revoked','expired')),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  responded_at timestamptz,
  revoked_at timestamptz,
  unique (token_hash),
  check (expires_at is null or expires_at > created_at)
);

create table if not exists public.meeting_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.meeting_rooms(id) on delete cascade,
  session_id uuid references public.meeting_sessions(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_participant_id uuid references public.meeting_session_participants(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 80),
  event_source text not null check (event_source in ('backend','livekit','webhook','client')),
  provider_event_id text check (provider_event_id is null or char_length(provider_event_id) between 1 and 180),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 180),
  sequence bigint not null default 0 check (sequence >= 0),
  payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(payload) = 'object'
    and not payload ?| array['raw_audio','raw_video','raw_screen','media_blob','recording','access_token','refresh_token','livekit_token']
  ),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (event_source, idempotency_key)
);

create table if not exists public.meeting_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.meeting_sessions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  participant_identity_hash text not null check (participant_identity_hash ~ '^[0-9a-f]{64}$'),
  role text not null check (role in ('host','cohost','speaker','participant','viewer','guest')),
  joined_at timestamptz not null,
  left_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  reconnect_count integer not null default 0 check (reconnect_count >= 0),
  final_state text not null default 'left' check (final_state in ('left','removed','disconnected','ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (left_at is null or left_at >= joined_at)
);

create unique index if not exists meeting_participants_session_user_unique on public.meeting_session_participants(session_id,user_id) where user_id is not null;
create unique index if not exists meeting_waiting_room_user_active_unique on public.meeting_waiting_entries(room_id,user_id) where status = 'waiting';
create unique index if not exists meeting_attendance_session_user_unique on public.meeting_attendance(session_id,user_id) where user_id is not null;
create unique index if not exists meeting_events_provider_event_unique on public.meeting_events(event_source,provider_event_id) where provider_event_id is not null;

create index if not exists idx_meeting_rooms_community_status on public.meeting_rooms(community_id,status,updated_at desc);
create index if not exists idx_meeting_rooms_channel_status on public.meeting_rooms(channel_id,status) where channel_id is not null;
create index if not exists idx_meeting_rooms_event on public.meeting_rooms(event_id) where event_id is not null;
create index if not exists idx_meeting_rooms_scheduled on public.meeting_rooms(scheduled_for) where status = 'scheduled';
create index if not exists idx_meeting_rooms_host on public.meeting_rooms(host_user_id,status);
create index if not exists idx_meeting_sessions_room_status on public.meeting_sessions(room_id,status,created_at desc);
create index if not exists idx_meeting_sessions_active on public.meeting_sessions(status,started_at desc) where status in ('preparing','live','reconnecting');
create index if not exists idx_meeting_participants_session_state on public.meeting_session_participants(session_id,state,last_seen_at desc);
create index if not exists idx_meeting_participants_user on public.meeting_session_participants(user_id,created_at desc) where user_id is not null;
create index if not exists idx_meeting_participants_active on public.meeting_session_participants(session_id,joined_at) where state in ('joining','connected','reconnecting');
create index if not exists idx_meeting_waiting_room_status on public.meeting_waiting_entries(room_id,status,requested_at);
create index if not exists idx_meeting_waiting_user on public.meeting_waiting_entries(user_id,status,requested_at desc);
create index if not exists idx_meeting_invites_room_status on public.meeting_invites(room_id,status,created_at desc);
create index if not exists idx_meeting_invites_user_status on public.meeting_invites(invited_user_id,status,created_at desc) where invited_user_id is not null;
create index if not exists idx_meeting_invites_expires on public.meeting_invites(expires_at) where status = 'active';
create index if not exists idx_meeting_events_session_time on public.meeting_events(session_id,occurred_at,id) where session_id is not null;
create index if not exists idx_meeting_events_room_time on public.meeting_events(room_id,occurred_at,id);
create index if not exists idx_meeting_events_type_time on public.meeting_events(event_type,occurred_at desc);
create index if not exists idx_meeting_attendance_session_join on public.meeting_attendance(session_id,joined_at);
create index if not exists idx_meeting_attendance_user_join on public.meeting_attendance(user_id,joined_at desc) where user_id is not null;

create or replace function public.validate_meeting_room_links()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.channel_id is not null and not exists (
    select 1 from public.channels channel
    where channel.id = new.channel_id and channel.community_id = new.community_id and channel.type = 'voice'
  ) then
    raise exception 'MEETING_VOICE_CHANNEL_MISMATCH' using errcode = '23514';
  end if;

  if new.event_id is not null and not exists (
    select 1 from public.community_events event
    where event.id = new.event_id and event.community_id = new.community_id
  ) then
    raise exception 'MEETING_EVENT_COMMUNITY_MISMATCH' using errcode = '23514';
  end if;

  if new.linked_chat_channel_id is not null and not exists (
    select 1 from public.channels channel
    where channel.id = new.linked_chat_channel_id
      and channel.community_id = new.community_id
      and channel.type in ('text','announcement')
  ) then
    raise exception 'MEETING_CHAT_CHANNEL_MISMATCH' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_meeting_room_links on public.meeting_rooms;
create trigger trg_validate_meeting_room_links
before insert or update of community_id,channel_id,event_id,linked_chat_channel_id,source_kind
on public.meeting_rooms for each row execute function public.validate_meeting_room_links();

create or replace function public.touch_meeting_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_meeting_rooms_updated_at on public.meeting_rooms;
create trigger trg_meeting_rooms_updated_at before update on public.meeting_rooms for each row execute function public.touch_meeting_updated_at();
drop trigger if exists trg_meeting_sessions_updated_at on public.meeting_sessions;
create trigger trg_meeting_sessions_updated_at before update on public.meeting_sessions for each row execute function public.touch_meeting_updated_at();
drop trigger if exists trg_meeting_participants_updated_at on public.meeting_session_participants;
create trigger trg_meeting_participants_updated_at before update on public.meeting_session_participants for each row execute function public.touch_meeting_updated_at();
drop trigger if exists trg_meeting_waiting_updated_at on public.meeting_waiting_entries;
create trigger trg_meeting_waiting_updated_at before update on public.meeting_waiting_entries for each row execute function public.touch_meeting_updated_at();
drop trigger if exists trg_meeting_attendance_updated_at on public.meeting_attendance;
create trigger trg_meeting_attendance_updated_at before update on public.meeting_attendance for each row execute function public.touch_meeting_updated_at();

alter table public.audit_log add column if not exists meeting_room_id uuid references public.meeting_rooms(id) on delete set null;
alter table public.audit_log add column if not exists meeting_session_id uuid references public.meeting_sessions(id) on delete set null;
create index if not exists idx_audit_log_meeting_room on public.audit_log(meeting_room_id,created_at desc) where meeting_room_id is not null;
create index if not exists idx_audit_log_meeting_session on public.audit_log(meeting_session_id,created_at desc) where meeting_session_id is not null;

alter table public.meeting_rooms enable row level security;
alter table public.meeting_sessions enable row level security;
alter table public.meeting_session_participants enable row level security;
alter table public.meeting_waiting_entries enable row level security;
alter table public.meeting_invites enable row level security;
alter table public.meeting_events enable row level security;
alter table public.meeting_attendance enable row level security;

revoke all on public.meeting_rooms,public.meeting_sessions,public.meeting_session_participants,public.meeting_waiting_entries,public.meeting_invites,public.meeting_events,public.meeting_attendance from anon,authenticated;

comment on table public.meeting_rooms is 'Durable Picom room configuration and safe metadata only; never raw audio/video/screen media.';
comment on table public.meeting_sessions is 'LiveKit session references without provider tokens or media payloads.';
comment on table public.meeting_events is 'Idempotent application/provider event projections; raw webhooks and credentials are forbidden.';
comment on table public.meeting_attendance is 'Privacy-bounded attendance metadata retained separately from ephemeral provider participants.';;
