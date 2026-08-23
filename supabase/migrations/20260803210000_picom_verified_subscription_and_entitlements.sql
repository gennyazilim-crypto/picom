-- PICOM Verified subscription, entitlements, verification session, and ad-eligibility foundation.
-- Additive only. Does not rewrite publisher/creator or foundation tables.

begin;

-- ---------------------------------------------------------------------------
-- Extend provider webhook receipt shape (foundation table)
-- ---------------------------------------------------------------------------
alter table public.provider_webhook_events
  add column if not exists api_version text,
  add column if not exists payload_created_at timestamptz,
  add column if not exists processing_started_at timestamptz,
  add column if not exists next_retry_at timestamptz,
  add column if not exists last_error_message_safe text;

alter table public.provider_webhook_events
  drop constraint if exists provider_webhook_events_processing_status_check;

alter table public.provider_webhook_events
  add constraint provider_webhook_events_processing_status_check
  check (processing_status in ('received', 'processing', 'processed', 'retry_scheduled', 'retrying', 'failed', 'ignored'));

-- ---------------------------------------------------------------------------
-- Billing customers / catalog / subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null check (provider in ('stripe')),
  provider_customer_id text not null check (char_length(btrim(provider_customer_id)) between 3 and 240),
  status text not null default 'active' check (status in ('active', 'disabled')),
  default_currency text not null default 'USD' check (default_currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_customer_id)
);

create unique index if not exists billing_customers_one_active_user_provider_uidx
  on public.billing_customers (user_id, provider)
  where status = 'active';

create table if not exists public.billing_products (
  id uuid primary key default gen_random_uuid(),
  product_key text not null check (product_key = 'picom_verified'),
  plan_key text not null check (plan_key in ('picom_verified_monthly', 'picom_verified_yearly')),
  provider text not null check (provider in ('stripe')),
  provider_product_id text not null check (char_length(btrim(provider_product_id)) between 3 and 240),
  provider_price_id text not null check (char_length(btrim(provider_price_id)) between 3 and 240),
  billing_interval text not null check (billing_interval in ('month', 'year')),
  interval_count integer not null default 1 check (interval_count > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor >= 0),
  status text not null default 'active' check (status in ('draft', 'active', 'retired')),
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_price_id),
  check (jsonb_typeof(metadata) = 'object'),
  check (effective_until is null or effective_until > effective_from)
);

create unique index if not exists billing_products_one_active_plan_uidx
  on public.billing_products (provider, plan_key)
  where status = 'active';

create table if not exists public.picom_verified_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  billing_customer_id uuid not null references public.billing_customers(id) on delete restrict,
  product_key text not null default 'picom_verified' check (product_key = 'picom_verified'),
  plan_key text not null check (plan_key in ('picom_verified_monthly', 'picom_verified_yearly')),
  provider text not null check (provider in ('stripe')),
  provider_subscription_id text not null check (char_length(btrim(provider_subscription_id)) between 3 and 240),
  provider_price_id text not null,
  status text not null check (status in (
    'incomplete', 'trialing', 'active', 'past_due', 'grace_period', 'paused', 'cancelled', 'expired', 'unpaid'
  )),
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  grace_until timestamptz,
  cancelled_at timestamptz,
  ended_at timestamptz,
  last_payment_status text,
  provider_state_version bigint not null default 0 check (provider_state_version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);

create index if not exists picom_verified_subscriptions_user_status_idx
  on public.picom_verified_subscriptions (user_id, status, current_period_end desc);

create table if not exists public.picom_verified_subscription_history (
  id bigint generated always as identity primary key,
  subscription_id uuid not null references public.picom_verified_subscriptions(id) on delete restrict,
  previous_status text,
  new_status text not null,
  source text not null check (char_length(btrim(source)) between 2 and 80),
  provider_event_id text,
  reason_code text,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now()
);

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.picom_verified_subscriptions(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  provider_invoice_id text not null check (char_length(btrim(provider_invoice_id)) between 3 and 240),
  provider_payment_intent_id text,
  status text not null check (status in ('draft', 'open', 'paid', 'void', 'uncollectible', 'failed')),
  amount_due_minor bigint not null default 0 check (amount_due_minor >= 0),
  amount_paid_minor bigint not null default 0 check (amount_paid_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  hosted_invoice_url text,
  invoice_pdf_url text,
  billing_period_start timestamptz,
  billing_period_end timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_invoice_id)
);

create table if not exists public.account_verification_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  verification_case_id uuid not null references public.verification_cases(id) on delete restrict,
  provider text not null check (provider in ('stripe_identity', 'manual_review')),
  provider_session_id text,
  status text not null default 'pending' check (status in (
    'pending', 'requires_input', 'processing', 'verified', 'canceled', 'failed', 'expired'
  )),
  return_url text,
  provider_state_version bigint not null default 0 check (provider_state_version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists account_verification_sessions_one_open_uidx
  on public.account_verification_sessions (user_id)
  where status in ('pending', 'requires_input', 'processing');

create table if not exists public.billing_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  plan_key text not null check (plan_key in ('picom_verified_monthly', 'picom_verified_yearly')),
  provider text not null check (provider in ('stripe')),
  provider_checkout_session_id text,
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 8 and 200),
  status text not null default 'created' check (status in ('created', 'open', 'complete', 'expired')),
  success_return_path text not null,
  cancel_return_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.picom_verified_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.picom_verified_prevent_history_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'PICOM_VERIFIED_HISTORY_APPEND_ONLY' using errcode = '55000';
end;
$$;

create or replace function public.picom_verified_subscription_is_entitling(target_status text, target_grace_until timestamptz)
returns boolean
language sql
immutable
as $$
  select case
    when target_status in ('active', 'trialing') then true
    when target_status in ('past_due', 'grace_period') and (target_grace_until is null or target_grace_until > now()) then true
    else false
  end;
$$;

create or replace function public.picom_verified_account_is_restricted(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = target_user_id
      and (
        coalesce(profile.is_deleted, false)
        or profile.deletion_requested_at is not null
        or coalesce(profile.status, '') in ('banned', 'suspended', 'disabled')
      )
  );
$$;

create or replace function public.picom_verified_email_is_verified(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from auth.users auth_user
    where auth_user.id = target_user_id
      and auth_user.email_confirmed_at is not null
  );
$$;

create or replace function public.record_picom_verified_subscription_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.picom_verified_subscription_history (subscription_id, new_status, source, reason_code)
    values (new.id, new.status, 'insert', 'subscription_created');
  elsif new.status is distinct from old.status then
    insert into public.picom_verified_subscription_history (subscription_id, previous_status, new_status, source, reason_code)
    values (new.id, old.status, new.status, 'status_change', coalesce(new.last_payment_status, 'status_transition'));
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Entitlement + badge reconciliation
-- ---------------------------------------------------------------------------
create or replace function public.reconcile_picom_verified_entitlements(target_user_id uuid, source_event text default 'manual')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  subscription_row public.picom_verified_subscriptions%rowtype;
  entitling boolean := false;
  entitlement_status text := 'expired';
  resolved_ends_at timestamptz := null;
  resolved_grace_until timestamptz := null;
begin
  if target_user_id is null then
    raise exception 'USER_REQUIRED' using errcode = '22023';
  end if;

  select * into subscription_row
  from public.picom_verified_subscriptions subscription
  where subscription.user_id = target_user_id
  order by
    case when public.picom_verified_subscription_is_entitling(subscription.status, subscription.grace_until) then 0 else 1 end,
    subscription.provider_state_version desc,
    subscription.updated_at desc
  limit 1;

  if found then
    entitling := public.picom_verified_subscription_is_entitling(subscription_row.status, subscription_row.grace_until);
    if entitling then
      if subscription_row.status in ('past_due', 'grace_period') then
        entitlement_status := 'grace_period';
        resolved_grace_until := subscription_row.grace_until;
      else
        entitlement_status := 'active';
      end if;
      resolved_ends_at := subscription_row.current_period_end;
    else
      entitlement_status := case when subscription_row.status in ('cancelled', 'expired', 'unpaid') then 'expired' else 'revoked' end;
      resolved_ends_at := coalesce(subscription_row.ended_at, subscription_row.current_period_end, now());
    end if;
  end if;

  -- Expire previous active/grace entitlements for this source before writing the reconciled state.
  update public.account_entitlements
  set status = case when entitling then 'expired' else entitlement_status end,
      ends_at = case when entitling then now() else coalesce(resolved_ends_at, now()) end,
      grace_until = null,
      updated_at = now(),
      version = version + 1,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('sourceEvent', left(coalesce(source_event, 'manual'), 120), 'superseded', true)
  where subject_type = 'user'
    and subject_id = target_user_id
    and entitlement_key in ('ad_free', 'verified_badge_eligible', 'priority_support')
    and source_type = 'picom_verified_subscription'
    and status in ('active', 'grace_period', 'pending');

  if entitling then
    insert into public.account_entitlements (
      subject_type, subject_id, entitlement_key, status, source_type, source_id, starts_at, ends_at, grace_until, metadata
    )
    select
      'user',
      target_user_id,
      needed.entitlement_key,
      entitlement_status,
      'picom_verified_subscription',
      subscription_row.id,
      coalesce(subscription_row.current_period_start, now()),
      resolved_ends_at,
      resolved_grace_until,
      jsonb_build_object('sourceEvent', left(coalesce(source_event, 'manual'), 120), 'planKey', subscription_row.plan_key)
    from unnest(array['ad_free', 'verified_badge_eligible', 'priority_support']) as needed(entitlement_key);
  end if;

  perform public.reconcile_verified_account_badge(target_user_id, source_event);

  return jsonb_build_object(
    'userId', target_user_id,
    'entitling', entitling,
    'entitlementStatus', entitlement_status,
    'subscriptionId', subscription_row.id,
    'sourceEvent', source_event
  );
end;
$$;

create or replace function public.reconcile_verified_account_badge(target_user_id uuid, source_event text default 'manual')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  entitlement_ok boolean := false;
  verification_ok boolean := false;
  email_ok boolean := false;
  restricted boolean := false;
  badge_id uuid;
  should_activate boolean := false;
begin
  select exists (
    select 1
    from public.account_entitlements
    where subject_type = 'user'
      and subject_id = target_user_id
      and entitlement_key = 'verified_badge_eligible'
      and status in ('active', 'grace_period')
  ) into entitlement_ok;

  select exists (
    select 1
    from public.verification_cases
    where subject_type = 'user'
      and subject_id = target_user_id
      and verification_type in ('picom_verified_account', 'picom_verified')
      and status = 'verified'
  ) into verification_ok;

  email_ok := public.picom_verified_email_is_verified(target_user_id);
  restricted := public.picom_verified_account_is_restricted(target_user_id);
  should_activate := entitlement_ok and verification_ok and email_ok and not restricted;

  select id into badge_id
  from public.verification_badges
  where subject_type = 'user'
    and subject_id = target_user_id
    and badge_kind = 'verified'
  order by granted_at desc
  limit 1;

  if should_activate then
    if badge_id is null then
      insert into public.verification_badges (
        subject_type, subject_id, badge_kind, label, scope_note, granted_by, status, source_type, source_id, is_primary, public_reason_code, metadata
      ) values (
        'user', target_user_id, 'verified', 'Verified',
        'PICOM Verified account after subscription and verification controls.',
        target_user_id, 'active', 'picom_verified_reconciliation', null, false, 'verified_account',
        jsonb_build_object('sourceEvent', left(coalesce(source_event, 'manual'), 120))
      )
      returning id into badge_id;
    else
      update public.verification_badges
      set status = 'active',
          revoked_at = null,
          suspended_at = null,
          public_reason_code = 'verified_account',
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('sourceEvent', left(coalesce(source_event, 'manual'), 120)),
          updated_at = now()
      where id = badge_id;
    end if;
  elsif badge_id is not null then
    update public.verification_badges
    set status = case
          when not entitlement_ok then 'expired'
          when restricted then 'suspended'
          else 'pending'
        end,
        suspended_at = case when restricted then now() else suspended_at end,
        revoked_at = case when not entitlement_ok then now() else revoked_at end,
        public_reason_code = case
          when not entitlement_ok then 'subscription_inactive'
          when not verification_ok then 'verification_incomplete'
          when not email_ok then 'email_unverified'
          when restricted then 'account_restricted'
          else public_reason_code
        end,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('sourceEvent', left(coalesce(source_event, 'manual'), 120)),
        updated_at = now()
    where id = badge_id;
  end if;

  return jsonb_build_object(
    'userId', target_user_id,
    'badgeActive', should_activate,
    'entitlementOk', entitlement_ok,
    'verificationOk', verification_ok,
    'emailOk', email_ok,
    'restricted', restricted,
    'badgeId', badge_id
  );
end;
$$;

create or replace function public.resolve_ad_eligibility(target_user_id uuid, target_placement text, target_context jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  placement text := lower(btrim(coalesce(target_placement, '')));
  content_kind text := lower(coalesce(target_context->>'contentKind', ''));
  ad_free boolean := false;
begin
  if placement = '' then
    raise exception 'AD_PLACEMENT_REQUIRED' using errcode = '22023';
  end if;

  if content_kind in ('organic_business', 'organic_creator', 'organic_publisher', 'security_announcement', 'service_announcement') then
    return jsonb_build_object('eligible', false, 'reason', 'not_paid_placement', 'placement', placement, 'contentKind', content_kind);
  end if;

  if target_user_id is not null then
    select exists (
      select 1
      from public.account_entitlements
      where subject_type = 'user'
        and subject_id = target_user_id
        and entitlement_key = 'ad_free'
        and status in ('active', 'grace_period')
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at > now() or (status = 'grace_period' and grace_until is not null and grace_until > now()))
    ) into ad_free;
  end if;

  if ad_free then
    return jsonb_build_object('eligible', false, 'reason', 'ad_free_entitlement', 'placement', placement);
  end if;

  if placement not in (
    'feed', 'feed_inline', 'companion_rail', 'community_rail', 'live_now', 'events', 'profile', 'search', 'notification', 'business_sponsored'
  ) then
    return jsonb_build_object('eligible', false, 'reason', 'unknown_placement', 'placement', placement);
  end if;

  return jsonb_build_object('eligible', true, 'reason', 'eligible_for_paid_placement', 'placement', placement);
end;
$$;

create or replace function public.get_picom_verified_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  subscription_row public.picom_verified_subscriptions%rowtype;
  ad_free boolean := false;
  badge_eligible boolean := false;
  priority_support boolean := false;
  verification_status text := 'missing';
  badge_status text := 'none';
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into subscription_row
  from public.picom_verified_subscriptions
  where user_id = actor_id
  order by updated_at desc
  limit 1;

  select exists (
    select 1 from public.account_entitlements
    where subject_type = 'user' and subject_id = actor_id and entitlement_key = 'ad_free' and status in ('active', 'grace_period')
  ) into ad_free;
  select exists (
    select 1 from public.account_entitlements
    where subject_type = 'user' and subject_id = actor_id and entitlement_key = 'verified_badge_eligible' and status in ('active', 'grace_period')
  ) into badge_eligible;
  select exists (
    select 1 from public.account_entitlements
    where subject_type = 'user' and subject_id = actor_id and entitlement_key = 'priority_support' and status in ('active', 'grace_period')
  ) into priority_support;

  select coalesce((
    select status from public.verification_cases
    where subject_type = 'user' and subject_id = actor_id and verification_type in ('picom_verified_account', 'picom_verified')
    order by updated_at desc limit 1
  ), 'missing') into verification_status;

  select coalesce((
    select status from public.verification_badges
    where subject_type = 'user' and subject_id = actor_id and badge_kind = 'verified'
    order by granted_at desc limit 1
  ), 'none') into badge_status;

  return jsonb_build_object(
    'subscriptionStatus', coalesce(subscription_row.status, 'none'),
    'planKey', subscription_row.plan_key,
    'currentPeriodEnd', subscription_row.current_period_end,
    'cancelAtPeriodEnd', coalesce(subscription_row.cancel_at_period_end, false),
    'entitlements', jsonb_build_object(
      'adFree', ad_free,
      'verifiedBadgeEligible', badge_eligible,
      'prioritySupport', priority_support
    ),
    'verificationDisplayState', verification_status,
    'badgeDisplayState', badge_status,
    'customerPortalAvailable', exists (
      select 1 from public.billing_customers customer
      where customer.user_id = actor_id and customer.status = 'active'
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
drop trigger if exists picom_verified_touch_customers on public.billing_customers;
create trigger picom_verified_touch_customers before update on public.billing_customers
for each row execute function public.picom_verified_touch_updated_at();

drop trigger if exists picom_verified_touch_products on public.billing_products;
create trigger picom_verified_touch_products before update on public.billing_products
for each row execute function public.picom_verified_touch_updated_at();

drop trigger if exists picom_verified_touch_subscriptions on public.picom_verified_subscriptions;
create trigger picom_verified_touch_subscriptions before update on public.picom_verified_subscriptions
for each row execute function public.picom_verified_touch_updated_at();

drop trigger if exists picom_verified_touch_invoices on public.billing_invoices;
create trigger picom_verified_touch_invoices before update on public.billing_invoices
for each row execute function public.picom_verified_touch_updated_at();

drop trigger if exists picom_verified_touch_verification_sessions on public.account_verification_sessions;
create trigger picom_verified_touch_verification_sessions before update on public.account_verification_sessions
for each row execute function public.picom_verified_touch_updated_at();

drop trigger if exists picom_verified_touch_checkout_sessions on public.billing_checkout_sessions;
create trigger picom_verified_touch_checkout_sessions before update on public.billing_checkout_sessions
for each row execute function public.picom_verified_touch_updated_at();

drop trigger if exists picom_verified_subscription_history_trg on public.picom_verified_subscriptions;
create trigger picom_verified_subscription_history_trg
after insert or update of status on public.picom_verified_subscriptions
for each row execute function public.record_picom_verified_subscription_history();

drop trigger if exists picom_verified_history_no_update on public.picom_verified_subscription_history;
create trigger picom_verified_history_no_update
before update or delete on public.picom_verified_subscription_history
for each row execute function public.picom_verified_prevent_history_mutation();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.billing_customers enable row level security;
alter table public.billing_products enable row level security;
alter table public.picom_verified_subscriptions enable row level security;
alter table public.picom_verified_subscription_history enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.account_verification_sessions enable row level security;
alter table public.billing_checkout_sessions enable row level security;

revoke all on public.billing_customers, public.billing_products, public.picom_verified_subscriptions,
  public.picom_verified_subscription_history, public.billing_invoices, public.account_verification_sessions,
  public.billing_checkout_sessions from public, anon, authenticated;

-- Public catalog view hides provider price/product IDs from authenticated clients.
create or replace view public.billing_catalog_public
with (security_barrier = true)
as
select
  plan_key,
  billing_interval,
  interval_count,
  currency,
  amount_minor,
  status,
  effective_from,
  effective_until
from public.billing_products
where status = 'active'
  and product_key = 'picom_verified';

grant select on public.billing_catalog_public to authenticated;
grant select on public.picom_verified_subscriptions, public.billing_invoices, public.account_verification_sessions,
  public.billing_checkout_sessions, public.billing_customers to authenticated;

-- Authenticated clients cannot select billing_products (provider IDs); service_role retains table access via bypass.

drop policy if exists picom_verified_subscriptions_owner_select on public.picom_verified_subscriptions;
create policy picom_verified_subscriptions_owner_select on public.picom_verified_subscriptions
for select to authenticated
using (user_id = auth.uid() or public.is_app_admin() or public.is_root_owner());

drop policy if exists picom_verified_invoices_owner_select on public.billing_invoices;
create policy picom_verified_invoices_owner_select on public.billing_invoices
for select to authenticated
using (user_id = auth.uid() or public.is_app_admin() or public.is_root_owner());

drop policy if exists picom_verified_sessions_owner_select on public.account_verification_sessions;
create policy picom_verified_sessions_owner_select on public.account_verification_sessions
for select to authenticated
using (user_id = auth.uid() or public.is_app_admin() or public.is_root_owner());

drop policy if exists picom_verified_checkout_owner_select on public.billing_checkout_sessions;
create policy picom_verified_checkout_owner_select on public.billing_checkout_sessions
for select to authenticated
using (user_id = auth.uid() or public.is_app_admin() or public.is_root_owner());

drop policy if exists picom_verified_customers_owner_select on public.billing_customers;
create policy picom_verified_customers_owner_select on public.billing_customers
for select to authenticated
using (user_id = auth.uid() or public.is_app_admin() or public.is_root_owner());

-- No insert/update/delete policies for authenticated → client cannot mutate billing state.

revoke all on function public.reconcile_picom_verified_entitlements(uuid, text),
  public.reconcile_verified_account_badge(uuid, text),
  public.picom_verified_touch_updated_at(),
  public.picom_verified_prevent_history_mutation(),
  public.record_picom_verified_subscription_history(),
  public.picom_verified_account_is_restricted(uuid),
  public.picom_verified_email_is_verified(uuid)
from public, anon, authenticated;

grant execute on function public.resolve_ad_eligibility(uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.get_picom_verified_summary() to authenticated;
grant execute on function public.reconcile_picom_verified_entitlements(uuid, text) to service_role;
grant execute on function public.reconcile_verified_account_badge(uuid, text) to service_role;

comment on table public.picom_verified_subscriptions is
  'PICOM Verified user subscriptions. Provider state is source of truth; clients cannot write status.';
comment on function public.resolve_ad_eligibility(uuid, text, jsonb) is
  'Server-side ad decision. ad_free suppresses paid placements only; organic business/creator content is not treated as ads.';

commit;
