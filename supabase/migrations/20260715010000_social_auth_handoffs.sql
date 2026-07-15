-- Short-lived session handoff store for custom social sign-in (Steam OpenID 2.0,
-- Epic OAuth2) that Supabase Auth has no native provider for. The steam-auth /
-- epic-auth Edge Functions run the external verification and mint a Supabase
-- session with the service-role key, then park the resulting tokens here keyed by a
-- high-entropy client nonce. The initiating client polls the Edge Function, which
-- reads and immediately consumes the row, so tokens are never placed in a URL and
-- the deep-link contract is untouched.
--
-- SECURITY: this table is service-role only (RLS enabled, no policies -> anon and
-- authenticated cannot read/write). Rows are single-use and expire in 5 minutes.
-- Storing refresh tokens even briefly is sensitive; a security review MUST sign off
-- before the steam-auth/epic-auth functions are deployed and enabled.
-- Forward-only and idempotent.
begin;

create table if not exists public.social_auth_handoffs (
  nonce text primary key,
  provider text not null check (provider in ('steam', 'epic')),
  status text not null default 'pending' check (status in ('pending', 'ready', 'consumed')),
  session jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes')
);

create index if not exists idx_social_auth_handoffs_expires_at
  on public.social_auth_handoffs (expires_at);

alter table public.social_auth_handoffs enable row level security;

-- No policies are defined on purpose: only the service-role key (which bypasses RLS)
-- may touch this table. Revoke the default anon/authenticated table grants as well.
revoke all on table public.social_auth_handoffs from anon, authenticated;

commit;
