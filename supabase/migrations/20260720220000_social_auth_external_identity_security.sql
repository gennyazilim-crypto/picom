-- Bind externally verified social identities to Supabase users without relying
-- on predictable synthetic email addresses. Only Edge Functions using the
-- service role may read or mutate this mapping.

create table if not exists public.social_auth_external_identities (
  provider text not null check (provider in ('steam', 'epic')),
  external_id text not null check (
    char_length(external_id) between 1 and 160
    and external_id !~ '[[:space:][:cntrl:]]'
  ),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  primary key (provider, external_id),
  unique (provider, user_id)
);

create index if not exists social_auth_external_identities_user_id_idx
  on public.social_auth_external_identities (user_id);

alter table public.social_auth_external_identities enable row level security;

revoke all on table public.social_auth_external_identities from public, anon, authenticated;
grant select, insert, update, delete on table public.social_auth_external_identities to service_role;

comment on table public.social_auth_external_identities is
  'Service-role-only binding between a provider identity and its Picom auth user.';

