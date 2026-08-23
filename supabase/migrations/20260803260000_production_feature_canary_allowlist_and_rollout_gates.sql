-- Production rollout canary allowlist + paid-feature gate inventory (additive).
-- Does NOT activate legal copy. Does NOT enable paid features.
-- Global paid switches remain fail-closed (false) unless Root mutates with audit.

begin;

create table if not exists public.feature_canary_allowlist (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null
    check (subject_type = any (array[
      'user'::text,
      'organization'::text,
      'advertiser'::text,
      'monetization_account'::text
    ])),
  subject_id uuid not null,
  feature_key text not null check (char_length(feature_key) between 3 and 120),
  environment text not null
    check (environment = any (array[
      'development'::text,
      'staging'::text,
      'production'::text
    ])),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  approved_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (char_length(reason) between 8 and 500),
  status text not null default 'active'
    check (status = any (array['active'::text, 'revoked'::text, 'expired'::text])),
  correlation_id uuid null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz null,
  revoked_by uuid null references public.profiles(id) on delete set null,
  revoke_reason text null,
  constraint feature_canary_allowlist_expiry_after_start check (expires_at > starts_at)
);

create unique index if not exists feature_canary_allowlist_active_uniq
  on public.feature_canary_allowlist (environment, feature_key, subject_type, subject_id)
  where status = 'active';

create index if not exists feature_canary_allowlist_lookup_idx
  on public.feature_canary_allowlist (environment, feature_key, status, expires_at);

create table if not exists public.feature_canary_allowlist_audit (
  id bigserial primary key,
  allowlist_id uuid null references public.feature_canary_allowlist(id) on delete set null,
  actor_id uuid null references public.profiles(id) on delete set null,
  action text not null,
  target text not null,
  reason text null,
  before_safe jsonb not null default '{}'::jsonb,
  after_safe jsonb not null default '{}'::jsonb,
  correlation_id uuid null,
  environment text not null,
  release_sha text null,
  created_at timestamptz not null default now()
);

create or replace function public.feature_canary_is_allowed(
  p_feature_key text,
  p_subject_type text,
  p_subject_id uuid,
  p_environment text default 'production'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.feature_canary_allowlist c
    where c.feature_key = p_feature_key
      and c.subject_type = p_subject_type
      and c.subject_id = p_subject_id
      and c.environment = p_environment
      and c.status = 'active'
      and c.starts_at <= now()
      and c.expires_at > now()
  );
$$;

revoke all on function public.feature_canary_is_allowed(text, text, uuid, text) from public, anon;
grant execute on function public.feature_canary_is_allowed(text, text, uuid, text) to authenticated, service_role;

create or replace function public.feature_canary_upsert(
  p_subject_type text,
  p_subject_id uuid,
  p_feature_key text,
  p_environment text,
  p_expires_at timestamptz,
  p_reason text,
  p_correlation_id uuid default null,
  p_release_sha text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_actor uuid := auth.uid();
begin
  if not public.is_root_owner() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_expires_at <= now() then
    raise exception 'CANARY_EXPIRY_REQUIRED_FUTURE' using errcode = '22000';
  end if;

  insert into public.feature_canary_allowlist (
    subject_type, subject_id, feature_key, environment,
    expires_at, approved_by, reason, status, correlation_id
  ) values (
    p_subject_type, p_subject_id, p_feature_key, p_environment,
    p_expires_at, v_actor, p_reason, 'active', p_correlation_id
  )
  on conflict (environment, feature_key, subject_type, subject_id)
    where status = 'active'
  do update set
    expires_at = excluded.expires_at,
    approved_by = excluded.approved_by,
    reason = excluded.reason,
    correlation_id = excluded.correlation_id
  returning id into v_id;

  insert into public.feature_canary_allowlist_audit (
    allowlist_id, actor_id, action, target, reason,
    after_safe, correlation_id, environment, release_sha
  ) values (
    v_id, v_actor, 'canary_upsert',
    format('%s:%s:%s', p_environment, p_feature_key, p_subject_id),
    p_reason,
    jsonb_build_object(
      'subject_type', p_subject_type,
      'feature_key', p_feature_key,
      'expires_at', p_expires_at
    ),
    p_correlation_id, p_environment, p_release_sha
  );

  return v_id;
end;
$$;

revoke all on function public.feature_canary_upsert(text, uuid, text, text, timestamptz, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.feature_canary_upsert(text, uuid, text, text, timestamptz, text, uuid, text)
  to service_role;

-- Expire active rows past expires_at (idempotent helper for workers / Root).
create or replace function public.feature_canary_expire_stale()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.feature_canary_allowlist
     set status = 'expired'
   where status = 'active'
     and expires_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.feature_canary_expire_stale() from public, anon, authenticated;
grant execute on function public.feature_canary_expire_stale() to service_role;

-- Re-assert fail-closed paid defaults when settings tables already exist.
do $gates$
begin
  if to_regclass('public.ad_platform_settings') is not null then
    insert into public.ad_platform_settings (setting_key, setting_value) values
      ('advertising_global_enabled', 'false'::jsonb),
      ('advertising_global_kill_switch', 'false'::jsonb),
      ('advertiser_onboarding_enabled', 'false'::jsonb),
      ('campaign_submission_enabled', 'false'::jsonb),
      ('campaign_activation_enabled', 'false'::jsonb)
    on conflict (setting_key) do nothing;
  end if;

  if to_regclass('public.payout_platform_settings') is not null then
    insert into public.payout_platform_settings (setting_key, setting_value) values
      ('creator_monetization_enabled', 'false'::jsonb),
      ('publisher_monetization_enabled', 'false'::jsonb),
      ('payout_onboarding_enabled', 'false'::jsonb),
      ('payout_batch_processing_enabled', 'false'::jsonb),
      ('real_payouts_enabled', 'false'::jsonb),
      ('global_payouts_kill_switch', 'true'::jsonb)
    on conflict (setting_key) do nothing;
  end if;
end;
$gates$;

alter table public.feature_canary_allowlist enable row level security;
alter table public.feature_canary_allowlist_audit enable row level security;

revoke all on table public.feature_canary_allowlist from public, anon, authenticated;
revoke all on table public.feature_canary_allowlist_audit from public, anon, authenticated;
grant select, insert, update, delete on table public.feature_canary_allowlist to service_role;
grant select, insert on table public.feature_canary_allowlist_audit to service_role;
grant select on table public.feature_canary_allowlist to authenticated;
grant select on table public.feature_canary_allowlist_audit to authenticated;

create policy feature_canary_root_select on public.feature_canary_allowlist
  for select to authenticated
  using (public.is_root_owner());

create policy feature_canary_audit_root_select on public.feature_canary_allowlist_audit
  for select to authenticated
  using (public.is_root_owner());

comment on table public.feature_canary_allowlist is
  'Root-only feature canary allowlist with mandatory expiry; global paid features stay disabled without an active row.';

commit;
