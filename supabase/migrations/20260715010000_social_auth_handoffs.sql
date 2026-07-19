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

create table if not exists public.social_auth_rate_limits (
  bucket_key text primary key check (bucket_key ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now()
);

create index if not exists idx_social_auth_rate_limits_updated_at
  on public.social_auth_rate_limits (updated_at);

alter table public.social_auth_handoffs enable row level security;
alter table public.social_auth_rate_limits enable row level security;

-- No policies are defined on purpose: only the service-role key (which bypasses RLS)
-- may touch this table. Revoke the default anon/authenticated table grants as well.
revoke all on table public.social_auth_handoffs from public, anon, authenticated;
revoke all on table public.social_auth_rate_limits from public, anon, authenticated;

-- Atomically consume one ready handoff. Row locking guarantees that concurrent poll
-- requests cannot both receive the same refresh token.
create or replace function public.consume_social_auth_handoff(target_nonce text)
returns table(result_status text, result_session jsonb)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  handoff public.social_auth_handoffs%rowtype;
begin
  if target_nonce is null or target_nonce !~ '^[A-Za-z0-9_-]{32,128}$' then
    return query select 'unknown'::text, null::jsonb;
    return;
  end if;

  select handoff_row.*
    into handoff
    from public.social_auth_handoffs as handoff_row
    where handoff_row.nonce = target_nonce
    for update;

  if not found then
    return query select 'unknown'::text, null::jsonb;
    return;
  end if;

  if handoff.expires_at <= now() then
    delete from public.social_auth_handoffs where nonce = target_nonce;
    return query select 'expired'::text, null::jsonb;
    return;
  end if;

  if handoff.status = 'ready' then
    update public.social_auth_handoffs
      set status = 'consumed', session = null
      where nonce = target_nonce and status = 'ready';
    if found then
      return query select 'ready'::text, handoff.session;
      return;
    end if;
  end if;

  return query select handoff.status::text, null::jsonb;
end;
$$;

-- Fixed-window abuse protection for unauthenticated provider-login starts. The Edge
-- Function sends only a salted SHA-256 bucket; raw client addresses are never stored.
create or replace function public.consume_social_auth_rate_limit(
  target_bucket text,
  max_requests integer default 10,
  window_seconds integer default 300
)
returns table(is_allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rate_row public.social_auth_rate_limits%rowtype;
  effective_max integer := least(greatest(max_requests, 1), 50);
  effective_window integer := least(greatest(window_seconds, 60), 3600);
begin
  if target_bucket is null or target_bucket !~ '^[a-f0-9]{64}$' then
    return query select false, effective_window;
    return;
  end if;

  delete from public.social_auth_rate_limits
    where updated_at < now() - interval '1 day';

  insert into public.social_auth_rate_limits as limits
    (bucket_key, window_started_at, request_count, updated_at)
  values
    (target_bucket, now(), 1, now())
  on conflict (bucket_key) do update
    set window_started_at = case
          when limits.window_started_at <= now() - make_interval(secs => effective_window) then now()
          else limits.window_started_at
        end,
        request_count = case
          when limits.window_started_at <= now() - make_interval(secs => effective_window) then 1
          else limits.request_count + 1
        end,
        updated_at = now()
  returning * into rate_row;

  return query
    select
      rate_row.request_count <= effective_max,
      greatest(
        0,
        ceil(extract(epoch from (rate_row.window_started_at + make_interval(secs => effective_window) - now())))::integer
      );
end;
$$;

revoke all on function public.consume_social_auth_handoff(text) from public, anon, authenticated;
revoke all on function public.consume_social_auth_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_social_auth_handoff(text) to service_role;
grant execute on function public.consume_social_auth_rate_limit(text, integer, integer) to service_role;

commit;
