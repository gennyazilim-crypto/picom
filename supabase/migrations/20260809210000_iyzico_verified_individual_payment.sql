-- PICOM Verified Individual: iyzico Link payment intents, independent verification,
-- idempotent entitlement activation, and expiry. No Business/Creator/Ads/Payout scope.
begin;

-- The existing subscription model remains canonical. iyzico payments are manual
-- renewals, so they have no provider customer or recurring subscription identifier.
alter table public.billing_products
  drop constraint if exists billing_products_provider_check;
alter table public.billing_products
  add constraint billing_products_provider_check check (provider in ('stripe', 'iyzico'));

alter table public.picom_verified_subscriptions
  alter column billing_customer_id drop not null,
  drop constraint if exists picom_verified_subscriptions_provider_check;
alter table public.picom_verified_subscriptions
  add constraint picom_verified_subscriptions_provider_check check (provider in ('stripe', 'iyzico'));

create table if not exists public.verified_payment_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null default 'iyzico' check (provider = 'iyzico'),
  product_key text not null default 'picom_verified' check (product_key = 'picom_verified'),
  plan_key text not null check (plan_key in ('picom_verified_monthly', 'picom_verified_yearly')),
  billing_interval text not null check (billing_interval in ('month', 'year')),
  interval_count integer not null default 1 check (interval_count > 0 and interval_count <= 12),
  expected_amount_minor bigint not null check (expected_amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  conversation_id text not null check (char_length(btrim(conversation_id)) between 16 and 240),
  provider_link_token text,
  payment_url text,
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 8 and 200),
  status text not null default 'created' check (status in ('created', 'awaiting_payment', 'verification_pending', 'paid', 'failed', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  verified_at timestamptz,
  provider_payment_id text,
  activation_subscription_id uuid references public.picom_verified_subscriptions(id) on delete restrict,
  failure_code text,
  updated_at timestamptz not null default now(),
  unique (conversation_id),
  unique (provider, provider_payment_id),
  unique (user_id, idempotency_key),
  check (expires_at > created_at),
  check ((status = 'paid') = (provider_payment_id is not null and verified_at is not null and activation_subscription_id is not null)),
  check (payment_url is null or payment_url ~ '^https://')
);

create index if not exists verified_payment_intents_user_status_created_idx
  on public.verified_payment_intents (user_id, status, created_at desc);
create index if not exists verified_payment_intents_expiry_idx
  on public.verified_payment_intents (expires_at)
  where status in ('created', 'awaiting_payment', 'verification_pending');

create table if not exists public.verified_payment_audit_events (
  id bigint generated always as identity primary key,
  payment_intent_id uuid not null references public.verified_payment_intents(id) on delete restrict,
  event_type text not null check (char_length(btrim(event_type)) between 3 and 120),
  source text not null check (source in ('server', 'webhook', 'reconciliation', 'expiry')),
  provider_event_id text,
  safe_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(safe_metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists verified_payment_audit_events_intent_created_idx
  on public.verified_payment_audit_events (payment_intent_id, created_at desc);

create or replace function public.verified_payment_audit_events_append_only()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'VERIFIED_PAYMENT_AUDIT_APPEND_ONLY' using errcode = '55000';
end;
$$;

drop trigger if exists verified_payment_intents_touch_updated_at on public.verified_payment_intents;
create trigger verified_payment_intents_touch_updated_at
before update on public.verified_payment_intents
for each row execute function public.picom_verified_touch_updated_at();

drop trigger if exists verified_payment_audit_events_no_mutation on public.verified_payment_audit_events;
create trigger verified_payment_audit_events_no_mutation
before update or delete on public.verified_payment_audit_events
for each row execute function public.verified_payment_audit_events_append_only();

-- This is intentionally service-role-only. The Edge Function independently verifies
-- the iyzico response before calling it; this RPC provides the transactional lock and
-- database-level one-payment/one-activation invariant.
create or replace function public.activate_iyzico_verified_payment(
  target_intent_id uuid,
  target_provider_payment_id text,
  target_verified_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  intent_row public.verified_payment_intents%rowtype;
  period_start timestamptz;
  period_end timestamptz;
  active_period_end timestamptz;
  subscription_id uuid;
begin
  if target_intent_id is null or target_provider_payment_id is null or char_length(btrim(target_provider_payment_id)) not between 1 and 240 then
    raise exception 'PAYMENT_REFERENCE_REQUIRED' using errcode = '22023';
  end if;

  select * into intent_row
  from public.verified_payment_intents
  where id = target_intent_id and provider = 'iyzico'
  for update;

  if not found then
    raise exception 'PAYMENT_INTENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if intent_row.status = 'paid' then
    if intent_row.provider_payment_id = target_provider_payment_id and intent_row.activation_subscription_id is not null then
      return jsonb_build_object(
        'activated', true,
        'idempotent', true,
        'subscriptionId', intent_row.activation_subscription_id,
        'paymentIntentId', intent_row.id
      );
    end if;
    raise exception 'PAYMENT_INTENT_ALREADY_FINALIZED' using errcode = '55000';
  end if;

  if intent_row.status in ('failed', 'expired', 'cancelled') or intent_row.expires_at <= coalesce(target_verified_at, now()) then
    raise exception 'PAYMENT_INTENT_NOT_ACTIVATABLE' using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(intent_row.user_id::text, 81472));

  if exists (
    select 1
    from public.verified_payment_intents
    where provider = 'iyzico'
      and provider_payment_id = target_provider_payment_id
      and id <> intent_row.id
  ) then
    raise exception 'PROVIDER_PAYMENT_ALREADY_CONSUMED' using errcode = '23505';
  end if;

  select max(ends_at) into active_period_end
  from public.account_entitlements
  where subject_type = 'user'
    and subject_id = intent_row.user_id
    and entitlement_key = 'verified_badge_eligible'
    and status in ('active', 'grace_period')
    and ends_at > target_verified_at;

  period_start := coalesce(active_period_end, target_verified_at);
  period_end := case intent_row.billing_interval
    when 'month' then period_start + make_interval(months => intent_row.interval_count)
    when 'year' then period_start + make_interval(years => intent_row.interval_count)
    else null
  end;

  if period_end is null or period_end <= period_start then
    raise exception 'PAYMENT_INTERVAL_INVALID' using errcode = '22023';
  end if;

  insert into public.picom_verified_subscriptions (
    user_id,
    billing_customer_id,
    product_key,
    plan_key,
    provider,
    provider_subscription_id,
    provider_price_id,
    status,
    current_period_start,
    current_period_end,
    last_payment_status,
    provider_state_version
  ) values (
    intent_row.user_id,
    null,
    'picom_verified',
    intent_row.plan_key,
    'iyzico',
    'iyzico_payment:' || target_provider_payment_id,
    'iyzico_link:' || coalesce(intent_row.provider_link_token, intent_row.id::text),
    'active',
    period_start,
    period_end,
    'verified',
    greatest(floor(extract(epoch from target_verified_at))::bigint, 1)
  )
  returning id into subscription_id;

  update public.verified_payment_intents
  set status = 'paid',
      verified_at = target_verified_at,
      provider_payment_id = target_provider_payment_id,
      activation_subscription_id = subscription_id,
      failure_code = null
  where id = intent_row.id;

  insert into public.verified_payment_audit_events (payment_intent_id, event_type, source, safe_metadata)
  values (
    intent_row.id,
    'payment_verified_and_activated',
    'server',
    jsonb_build_object(
      'subscriptionId', subscription_id,
      'periodStart', period_start,
      'periodEnd', period_end,
      'renewal', active_period_end is not null
    )
  );

  perform public.reconcile_picom_verified_entitlements(intent_row.user_id, 'iyzico_verified_payment');

  return jsonb_build_object(
    'activated', true,
    'idempotent', false,
    'subscriptionId', subscription_id,
    'paymentIntentId', intent_row.id,
    'periodStart', period_start,
    'periodEnd', period_end
  );
end;
$$;

create or replace function public.expire_iyzico_verified_payment_intents()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  expired_count integer := 0;
  intent_id uuid;
begin
  for intent_id in
    update public.verified_payment_intents
    set status = 'expired', failure_code = coalesce(failure_code, 'PAYMENT_INTENT_EXPIRED')
    where provider = 'iyzico'
      and status in ('created', 'awaiting_payment', 'verification_pending')
      and expires_at <= now()
    returning id
  loop
    insert into public.verified_payment_audit_events (payment_intent_id, event_type, source)
    values (intent_id, 'payment_intent_expired', 'expiry');
    expired_count := expired_count + 1;
  end loop;
  return expired_count;
end;
$$;

create or replace function public.expire_picom_verified_entitlements()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  expired_count integer := 0;
  affected_user_id uuid;
begin
  for affected_user_id in
    update public.picom_verified_subscriptions
    set status = 'expired',
        ended_at = coalesce(ended_at, current_period_end, now()),
        provider_state_version = greatest(provider_state_version, floor(extract(epoch from now()))::bigint),
        last_payment_status = 'period_expired'
    where status in ('active', 'trialing', 'past_due', 'grace_period')
      and current_period_end is not null
      and current_period_end <= now()
      and (grace_until is null or grace_until <= now())
    returning user_id
  loop
    perform public.reconcile_picom_verified_entitlements(affected_user_id, 'scheduled_period_expiry');
    expired_count := expired_count + 1;
  end loop;
  return expired_count;
end;
$$;

-- The existing reconciliation function treated an `active` row as entitling even
-- after its period end. Preserve its canonical rows, but make time-bound periods
-- fail closed before the scheduled expiry job next runs.
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
    case when public.picom_verified_subscription_is_entitling(subscription.status, subscription.grace_until)
        and (subscription.current_period_end is null or subscription.current_period_end > now() or (subscription.status in ('past_due', 'grace_period') and subscription.grace_until > now()))
      then 0 else 1 end,
    subscription.provider_state_version desc,
    subscription.updated_at desc
  limit 1;

  if found then
    entitling := public.picom_verified_subscription_is_entitling(subscription_row.status, subscription_row.grace_until)
      and (
        subscription_row.current_period_end is null
        or subscription_row.current_period_end > now()
        or (subscription_row.status in ('past_due', 'grace_period') and subscription_row.grace_until > now())
      );
    if entitling then
      if subscription_row.status in ('past_due', 'grace_period') then
        entitlement_status := 'grace_period';
        resolved_grace_until := subscription_row.grace_until;
      else
        entitlement_status := 'active';
      end if;
      resolved_ends_at := subscription_row.current_period_end;
    else
      entitlement_status := case when subscription_row.status in ('cancelled', 'expired', 'unpaid') or subscription_row.current_period_end <= now() then 'expired' else 'revoked' end;
      resolved_ends_at := coalesce(subscription_row.ended_at, subscription_row.current_period_end, now());
    end if;
  end if;

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
      'user', target_user_id, needed.entitlement_key, entitlement_status,
      'picom_verified_subscription', subscription_row.id,
      coalesce(subscription_row.current_period_start, now()), resolved_ends_at, resolved_grace_until,
      jsonb_build_object('sourceEvent', left(coalesce(source_event, 'manual'), 120), 'planKey', subscription_row.plan_key)
    from unnest(array['ad_free', 'verified_badge_eligible', 'priority_support']) as needed(entitlement_key);
  end if;

  perform public.reconcile_verified_account_badge(target_user_id, source_event);
  return jsonb_build_object('userId', target_user_id, 'entitling', entitling, 'entitlementStatus', entitlement_status, 'subscriptionId', subscription_row.id, 'sourceEvent', source_event);
end;
$$;

create or replace function public.get_picom_verified_payment_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  intent_row public.verified_payment_intents%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into intent_row
  from public.verified_payment_intents
  where user_id = actor_id
  order by created_at desc
  limit 1;

  if not found then return null; end if;
  return jsonb_build_object(
    'intentId', intent_row.id,
    'planKey', intent_row.plan_key,
    'billingInterval', intent_row.billing_interval,
    'status', intent_row.status,
    'expiresAt', intent_row.expires_at,
    'verifiedAt', intent_row.verified_at,
    'failureCode', intent_row.failure_code,
    'activated', intent_row.activation_subscription_id is not null
  );
end;
$$;

alter table public.verified_payment_intents enable row level security;
alter table public.verified_payment_audit_events enable row level security;
revoke all on public.verified_payment_intents, public.verified_payment_audit_events from public, anon, authenticated;
revoke all on function public.activate_iyzico_verified_payment(uuid, text, timestamptz),
  public.expire_iyzico_verified_payment_intents(),
  public.expire_picom_verified_entitlements(),
  public.verified_payment_audit_events_append_only()
from public, anon, authenticated;
revoke all on function public.get_picom_verified_payment_status() from public, anon;
grant execute on function public.activate_iyzico_verified_payment(uuid, text, timestamptz),
  public.expire_iyzico_verified_payment_intents(),
  public.expire_picom_verified_entitlements() to service_role;
grant execute on function public.get_picom_verified_payment_status() to authenticated;

select cron.unschedule('expire-iyzico-verified-payment-intents')
  where exists (select 1 from cron.job where jobname = 'expire-iyzico-verified-payment-intents');
select cron.schedule('expire-iyzico-verified-payment-intents', '*/5 * * * *',
  $$select public.expire_iyzico_verified_payment_intents();$$);
select cron.unschedule('expire-picom-verified-entitlements')
  where exists (select 1 from cron.job where jobname = 'expire-picom-verified-entitlements');
select cron.schedule('expire-picom-verified-entitlements', '*/15 * * * *',
  $$select public.expire_picom_verified_entitlements();$$);

comment on table public.verified_payment_intents is
  'PICOM Verified Individual iyzico payment intents. Only trusted server code can change provider or payment state.';
comment on function public.activate_iyzico_verified_payment(uuid, text, timestamptz) is
  'Server-only, locking activation of an independently verified iyzico payment into the canonical PICOM Verified entitlement model.';

commit;
