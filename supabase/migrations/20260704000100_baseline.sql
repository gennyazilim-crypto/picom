-- Picom MVP database baseline
-- This migration creates the core Supabase/Postgres tables for the desktop chat MVP.
-- RLS is enabled by default; access policies are added in follow-up tasks.

create extension if not exists pgcrypto with schema extensions;
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  avatar_url text,
  status text not null default 'offline' check (status in ('online', 'idle', 'dnd', 'offline')),
  status_text text not null default 'Offline',
  bio text,
  accent_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  description text,
  icon_url text,
  accent_color text not null default '#007571',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  color text not null default 'var(--text-muted)',
  level integer not null default 0,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, name)
);
create table if not exists public.community_members (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid references public.roles(id) on delete set null,
  joined_at timestamptz not null default now(),
  unique (community_id, user_id)
);
create table if not exists public.channel_categories (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  category_id uuid references public.channel_categories(id) on delete set null,
  name text not null,
  type text not null default 'text' check (type in ('text', 'voice')),
  topic text,
  is_private boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, name)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null default '',
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  attachment_type text not null default 'image' check (attachment_type in ('image')),
  width integer,
  height integer,
  created_at timestamptz not null default now()
);
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);
create table if not exists public.read_states (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_message_id uuid references public.messages(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (channel_id, user_id)
);
create index if not exists idx_community_members_user_id on public.community_members(user_id);
create index if not exists idx_community_members_community_id on public.community_members(community_id);
create index if not exists idx_channels_community_position on public.channels(community_id, position);
create index if not exists idx_channel_categories_community_position on public.channel_categories(community_id, position);
create index if not exists idx_messages_channel_created_at on public.messages(channel_id, created_at desc);
create index if not exists idx_messages_author_created_at on public.messages(author_id, created_at desc);
create index if not exists idx_attachments_message_id on public.attachments(message_id);
create index if not exists idx_reactions_message_id on public.message_reactions(message_id);
create index if not exists idx_read_states_user_channel on public.read_states(user_id, channel_id);
alter table public.profiles enable row level security;
alter table public.communities enable row level security;
alter table public.roles enable row level security;
alter table public.community_members enable row level security;
alter table public.channel_categories enable row level security;
alter table public.channels enable row level security;
alter table public.messages enable row level security;
alter table public.attachments enable row level security;
alter table public.message_reactions enable row level security;
alter table public.read_states enable row level security;
