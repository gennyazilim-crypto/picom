create table if not exists public.bot_credentials (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  token_prefix text not null check (char_length(token_prefix) between 6 and 32),
  token_hash text not null unique check (char_length(token_hash) >= 64),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create unique index if not exists bot_credentials_one_active_per_bot_idx
  on public.bot_credentials (bot_id)
  where revoked_at is null;

create index if not exists bot_credentials_prefix_idx
  on public.bot_credentials (token_prefix)
  where revoked_at is null;

alter table public.bot_credentials enable row level security;
revoke all on table public.bot_credentials from anon, authenticated;

comment on table public.bot_credentials is
  'Backend-only bot credential hashes. Raw bot tokens must never be stored, selected by renderer clients, or written to logs.';
comment on column public.bot_credentials.token_hash is
  'One-way hash of a high-entropy bot token. The raw token is returned once by a future trusted Edge Function.';

-- No renderer-facing RLS policy is intentionally created. A future trusted Edge
-- Function using protected server credentials may issue, authenticate, rotate,
-- and revoke bot credentials after validating app/community permissions.
