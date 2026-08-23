-- TASK31: Subscription entitlements + cancel request + checkout gates (provider-neutral).

begin;

create table if not exists public.publisher_subscription_entitlements (
  id uuid primary key default gen_random_uuid(),
  publisher_user_id uuid not null references public.profiles(id) on delete restrict,
  subscriber_user_id uuid not null references public.profiles(id) on delete restrict,
  entitlement_type text not null default 'publisher_subscriber'
    check (entitlement_type in ('publisher_subscriber')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'grace_period', 'expired', 'revoked', 'cancelled')),
  starts_at timestamptz,
  expires_at timestamptz,
  source_subscription_id uuid not null references public.publisher_subscriptions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or starts_at is null or expires_at >= starts_at)
);

create unique index if not exists publisher_subscription_entitlements_active_uidx
  on public.publisher_subscription_entitlements (publisher_user_id, subscriber_user_id, entitlement_type)
  where status in ('active', 'grace_period');

create index if not exists publisher_subscription_entitlements_subscriber_idx
  on public.publisher_subscription_entitlements (subscriber_user_id, status);

create trigger publisher_subscription_entitlements_touch_updated_at
  before update on public.publisher_subscription_entitlements
  for each row execute function public.verification_business_touch_updated_at();

alter table public.publisher_subscription_entitlements enable row level security;

drop policy if exists publisher_entitlements_party_select on public.publisher_subscription_entitlements;
create policy publisher_entitlements_party_select
  on public.publisher_subscription_entitlements
  for select to authenticated
  using (
    publisher_user_id = auth.uid()
    or subscriber_user_id = auth.uid()
    or public.publisher_finance_has_finance_read()
  );

revoke all on table public.publisher_subscription_entitlements from anon, authenticated;
grant select on table public.publisher_subscription_entitlements to authenticated;
grant all on table public.publisher_subscription_entitlements to service_role;

-- Sync entitlement from trusted subscription status (service only).
create or replace function public.service_sync_publisher_subscription_entitlement(
  p_subscription_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sub public.publisher_subscriptions%rowtype;
  ent_status text;
begin
  select * into sub from public.publisher_subscriptions where id = p_subscription_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'SUBSCRIPTION_NOT_FOUND');
  end if;

  ent_status := case
    when sub.status in ('ACTIVE', 'CANCEL_AT_PERIOD_END') then 'active'
    when sub.status = 'TRIALING' then 'active'
    when sub.status in ('CANCELLED', 'EXPIRED', 'UNPAID') then 'expired'
    else 'pending'
  end;

  if exists (
    select 1 from public.publisher_subscription_entitlements e
    where e.source_subscription_id = sub.id
  ) then
    update public.publisher_subscription_entitlements e
    set
      status = ent_status,
      starts_at = coalesce(sub.current_period_start, e.starts_at),
      expires_at = sub.current_period_end,
      updated_at = now()
    where e.source_subscription_id = sub.id;
  else
    insert into public.publisher_subscription_entitlements (
      publisher_user_id, subscriber_user_id, entitlement_type, status,
      starts_at, expires_at, source_subscription_id
    ) values (
      sub.publisher_user_id, sub.subscriber_user_id, 'publisher_subscriber', ent_status,
      coalesce(sub.current_period_start, now()),
      sub.current_period_end,
      sub.id
    );
  end if;

  return jsonb_build_object('ok', true, 'status', ent_status);
end;
$$;

revoke all on function public.service_sync_publisher_subscription_entitlement(uuid) from public, anon, authenticated;
grant execute on function public.service_sync_publisher_subscription_entitlement(uuid) to service_role;

-- Subscriber cancel-at-period-end request (ownership verified). Webhook remains authoritative for final status.
create or replace function public.request_cancel_publisher_subscription(
  p_subscription_id uuid,
  p_immediate boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  sub public.publisher_subscriptions%rowtype;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into sub from public.publisher_subscriptions where id = p_subscription_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if sub.subscriber_user_id <> actor then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  if sub.status not in ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCEL_AT_PERIOD_END') then
    return jsonb_build_object('ok', false, 'error', 'NOT_CANCELLABLE');
  end if;

  -- Immediate cancel only if product/provider policy supports; without provider, reject immediate.
  if p_immediate then
    return jsonb_build_object('ok', false, 'error', 'IMMEDIATE_CANCEL_UNSUPPORTED', 'provider', 'NOT_CONFIGURED');
  end if;

  update public.publisher_subscriptions
  set cancel_at_period_end = true,
      status = 'CANCEL_AT_PERIOD_END',
      updated_at = now()
  where id = sub.id;

  insert into public.publisher_finance_audit_events (
    event_type, actor_user_id, publisher_user_id, economic_reference_type, economic_reference_id, correlation_id, metadata
  ) values (
    'SUBSCRIPTION_CANCEL_REQUESTED', actor, sub.publisher_user_id, 'subscription', sub.id,
    'cancel:' || sub.id::text,
    jsonb_build_object('mode', 'cancel_at_period_end')
  );

  return jsonb_build_object('ok', true, 'status', 'CANCEL_AT_PERIOD_END', 'pending_provider_confirmation', true);
end;
$$;

revoke all on function public.request_cancel_publisher_subscription(uuid, boolean) from public, anon;
grant execute on function public.request_cancel_publisher_subscription(uuid, boolean) to authenticated, service_role;

-- Own entitlement status (safe)
create or replace function public.get_my_publisher_subscription_entitlement(
  p_publisher_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  row_data public.publisher_subscription_entitlements%rowtype;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into row_data
  from public.publisher_subscription_entitlements e
  where e.publisher_user_id = p_publisher_user_id
    and e.subscriber_user_id = actor
    and e.status in ('active', 'grace_period')
  order by e.updated_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'active', false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'active', true,
    'entitlement_type', row_data.entitlement_type,
    'status', row_data.status,
    'starts_at', row_data.starts_at,
    'expires_at', row_data.expires_at,
    'source_subscription_id', row_data.source_subscription_id
  );
end;
$$;

revoke all on function public.get_my_publisher_subscription_entitlement(uuid) from public, anon;
grant execute on function public.get_my_publisher_subscription_entitlement(uuid) to authenticated, service_role;

-- Checkout session gate: fail closed without provider
create or replace function public.create_publisher_checkout_session(
  p_product_id uuid,
  p_kind text,
  p_donation_amount_minor bigint default null,
  p_currency text default null,
  p_anonymous_display boolean default false,
  p_message text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  product public.publisher_subscription_products%rowtype;
  eligibility text;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_kind not in ('subscription', 'donation') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_KIND');
  end if;

  -- Public monetization blocked until provider + flags certified.
  return jsonb_build_object(
    'ok', false,
    'error', 'PAYMENT_PROVIDER_NOT_CONFIGURED',
    'code', 'BLOCKED_PROVIDER_CONFIGURATION',
    'message', 'Payment provider runtime is not configured. Checkout is unavailable.'
  );
end;
$$;

revoke all on function public.create_publisher_checkout_session(uuid, text, bigint, text, boolean, text, text) from public, anon;
grant execute on function public.create_publisher_checkout_session(uuid, text, bigint, text, boolean, text, text) to authenticated, service_role;

-- Extend account_entitlements key allowlist for subscriber badge readiness (optional future).
-- Safe no-op if constraint already expanded elsewhere; attempt additive check replacement carefully.
do $$
begin
  -- Keep existing entitlement keys; publisher_subscriber is tracked in publisher_subscription_entitlements.
  null;
end $$;

comment on table public.publisher_subscription_entitlements is
  'Subscriber entitlements separate from payment UI. Subscriber-only chat remains OFF until runtime certified.';

commit;
