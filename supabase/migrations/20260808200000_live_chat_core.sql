-- Live Chat core for publisher_streams (TASK28).
-- Dedicated domain — does not reuse community channel permissions.
-- Forward-only. Soft-delete moderation. Mutations via SECURITY DEFINER RPCs.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.live_chat_settings (
  stream_id uuid primary key references public.publisher_streams(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  live_session_id uuid references public.community_live_screen_sessions(id) on delete set null,
  chat_enabled boolean not null default true,
  slow_mode_seconds integer not null default 0
    check (slow_mode_seconds in (0, 5, 10, 30, 60, 120)),
  followers_only boolean not null default false,
  verified_only boolean not null default false,
  links_allowed boolean not null default true,
  reactions_enabled boolean not null default true,
  max_message_length integer not null default 500
    check (max_message_length between 50 and 1000),
  moderation_mode text not null default 'standard'
    check (moderation_mode in ('standard', 'strict', 'relaxed')),
  emergency_locked boolean not null default false,
  emergency_lock_reason text,
  pinned_message_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_chat_messages (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.publisher_streams(id) on delete cascade,
  live_session_id uuid references public.community_live_screen_sessions(id) on delete set null,
  sender_user_id uuid not null references public.profiles(id) on delete cascade,
  message_type text not null default 'text'
    check (message_type in ('text', 'system', 'moderator_notice')),
  body text not null check (char_length(body) between 1 and 1000),
  reply_to_message_id uuid references public.live_chat_messages(id) on delete set null,
  moderation_state text not null default 'visible'
    check (moderation_state in ('visible', 'deleted_by_sender', 'deleted_by_moderator', 'removed_by_system')),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  client_idempotency_key text,
  body_fingerprint text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create unique index if not exists live_chat_messages_idempotency_uidx
  on public.live_chat_messages (stream_id, sender_user_id, client_idempotency_key)
  where client_idempotency_key is not null;

create index if not exists live_chat_messages_stream_created_idx
  on public.live_chat_messages (stream_id, created_at desc, id desc);

create index if not exists live_chat_messages_stream_visible_idx
  on public.live_chat_messages (stream_id, created_at desc)
  where moderation_state = 'visible';

create table if not exists public.live_chat_reactions (
  message_id uuid not null references public.live_chat_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_key text not null
    check (reaction_key in ('like', 'love', 'laugh', 'wow', 'sad', 'angry')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, reaction_key)
);

create index if not exists live_chat_reactions_message_idx
  on public.live_chat_reactions (message_id, created_at desc);

create table if not exists public.live_chat_moderators (
  stream_id uuid not null references public.publisher_streams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  primary key (stream_id, user_id)
);

create index if not exists live_chat_moderators_active_idx
  on public.live_chat_moderators (stream_id, user_id)
  where revoked_at is null;

create table if not exists public.live_chat_timeouts (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.publisher_streams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  reason text not null default '' check (char_length(reason) <= 500),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

create index if not exists live_chat_timeouts_active_idx
  on public.live_chat_timeouts (stream_id, user_id, expires_at desc);

create table if not exists public.live_chat_bans (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.publisher_streams(id) on delete cascade,
  banned_user_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null
);

create unique index if not exists live_chat_bans_active_uidx
  on public.live_chat_bans (stream_id, banned_user_id)
  where revoked_at is null;

create index if not exists live_chat_bans_stream_idx
  on public.live_chat_bans (stream_id, created_at desc);

create table if not exists public.live_chat_reports (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.publisher_streams(id) on delete cascade,
  reporter_user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid references public.live_chat_messages(id) on delete set null,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null
    check (category in ('spam', 'harassment', 'hate', 'sexual', 'scam', 'other')),
  description text not null default '' check (char_length(description) <= 1000),
  status text not null default 'open'
    check (status in ('open', 'reviewed', 'dismissed', 'action_taken')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists live_chat_reports_dedupe_message_uidx
  on public.live_chat_reports (stream_id, reporter_user_id, message_id, category)
  where status = 'open' and message_id is not null;

create unique index if not exists live_chat_reports_dedupe_user_uidx
  on public.live_chat_reports (stream_id, reporter_user_id, target_user_id, category)
  where status = 'open' and message_id is null;

create index if not exists live_chat_reports_stream_created_idx
  on public.live_chat_reports (stream_id, created_at desc);

create table if not exists public.live_chat_rate_limits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  stream_id uuid not null references public.publisher_streams(id) on delete cascade,
  action text not null,
  window_started_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  primary key (user_id, stream_id, action, window_started_at)
);

create index if not exists live_chat_rate_limits_window_idx
  on public.live_chat_rate_limits (window_started_at);

create table if not exists public.live_chat_audit_events (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.publisher_streams(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  message_id uuid,
  event_type text not null,
  reason text,
  correlation_id text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists live_chat_audit_stream_created_idx
  on public.live_chat_audit_events (stream_id, created_at desc);

alter table public.live_chat_settings
  drop constraint if exists live_chat_settings_pinned_fk;
alter table public.live_chat_settings
  add constraint live_chat_settings_pinned_fk
  foreign key (pinned_message_id) references public.live_chat_messages(id) on delete set null;

comment on table public.live_chat_messages is
  'Stream-scoped live chat for publisher_streams. Soft-deleted for moderation evidence. Retention: indefinite pending policy.';
comment on table public.live_chat_settings is
  'Per-stream chat settings. subscribers_only not exposed (no entitlement system).';

alter table public.live_chat_settings enable row level security;
alter table public.live_chat_settings force row level security;
alter table public.live_chat_messages enable row level security;
alter table public.live_chat_messages force row level security;
alter table public.live_chat_reactions enable row level security;
alter table public.live_chat_reactions force row level security;
alter table public.live_chat_moderators enable row level security;
alter table public.live_chat_moderators force row level security;
alter table public.live_chat_timeouts enable row level security;
alter table public.live_chat_timeouts force row level security;
alter table public.live_chat_bans enable row level security;
alter table public.live_chat_bans force row level security;
alter table public.live_chat_reports enable row level security;
alter table public.live_chat_reports force row level security;
alter table public.live_chat_rate_limits enable row level security;
alter table public.live_chat_rate_limits force row level security;
alter table public.live_chat_audit_events enable row level security;
alter table public.live_chat_audit_events force row level security;

revoke all on table public.live_chat_settings from public, anon, authenticated;
revoke all on table public.live_chat_messages from public, anon, authenticated;
revoke all on table public.live_chat_reactions from public, anon, authenticated;
revoke all on table public.live_chat_moderators from public, anon, authenticated;
revoke all on table public.live_chat_timeouts from public, anon, authenticated;
revoke all on table public.live_chat_bans from public, anon, authenticated;
revoke all on table public.live_chat_reports from public, anon, authenticated;
revoke all on table public.live_chat_rate_limits from public, anon, authenticated;
revoke all on table public.live_chat_audit_events from public, anon, authenticated;

grant all on table public.live_chat_settings to service_role;
grant all on table public.live_chat_messages to service_role;
grant all on table public.live_chat_reactions to service_role;
grant all on table public.live_chat_moderators to service_role;
grant all on table public.live_chat_timeouts to service_role;
grant all on table public.live_chat_bans to service_role;
grant all on table public.live_chat_reports to service_role;
grant all on table public.live_chat_rate_limits to service_role;
grant all on table public.live_chat_audit_events to service_role;

grant select on table public.live_chat_settings to authenticated;
grant select on table public.live_chat_messages to authenticated;
grant select on table public.live_chat_reactions to authenticated;
grant select on table public.live_chat_moderators to authenticated;
grant select on table public.live_chat_timeouts to authenticated;
grant select on table public.live_chat_bans to authenticated;
grant select on table public.live_chat_reports to authenticated;
grant select on table public.live_chat_audit_events to authenticated;

commit;
