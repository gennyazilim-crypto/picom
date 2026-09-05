-- PICOM advertiser campaign delivery, budget ledger, and partner revenue attribution.
-- Additive only. Does not rewrite prior migrations or DROP TABLE.
begin;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Platform settings / kill switches
-- ---------------------------------------------------------------------------
create table if not exists public.ad_platform_settings (
  setting_key text primary key check (char_length(btrim(setting_key)) between 2 and 80),
  setting_value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.ad_platform_settings (setting_key, setting_value) values
  ('advertising_enabled', 'true'::jsonb),
  ('advertising_global_kill_switch', 'false'::jsonb),
  ('political_advertising_enabled', 'false'::jsonb),
  ('ad_scheduler_enabled', 'false'::jsonb),
  ('ad_reconciliation_enabled', 'false'::jsonb)
on conflict (setting_key) do nothing;

create table if not exists public.ad_placements (
  placement_key text primary key check (placement_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  surface text not null,
  format text not null default 'card',
  enabled boolean not null default false,
  requires_manual_review boolean not null default true,
  sponsored_label_required boolean not null default true,
  ad_free_suppressed boolean not null default true,
  supported_objectives text[] not null default array['awareness','traffic','engagement']::text[],
  billing_events text[] not null default array['impression','click']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ad_placements (placement_key, surface, format, enabled) values
  ('feed_inline', 'feed', 'inline', false),
  ('feed_between_posts', 'feed', 'inline', false),
  ('companion_rail', 'companion', 'rail_card', false),
  ('community_rail', 'community', 'rail_card', false),
  ('live_now_featured', 'live_now', 'featured', false),
  ('live_now_card', 'live_now', 'card', false),
  ('events_featured', 'events', 'featured', false),
  ('event_detail_sponsor', 'events', 'sponsor', false),
  ('business_profile_recommendation', 'business', 'recommendation', false),
  ('creator_content_sponsor', 'creator', 'sponsor', false),
  ('publisher_community_sponsor', 'publisher', 'sponsor', false),
  ('business_sponsored', 'business', 'sponsored', false)
on conflict (placement_key) do nothing;

-- ---------------------------------------------------------------------------
-- Advertiser account extensions
-- ---------------------------------------------------------------------------
alter table public.advertiser_accounts
  add column if not exists legal_name text,
  add column if not exists country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  add column if not exists billing_currency text not null default 'USD' check (billing_currency ~ '^[A-Z]{3}$'),
  add column if not exists spend_limit_minor bigint check (spend_limit_minor is null or spend_limit_minor >= 0),
  add column if not exists daily_spend_limit_minor bigint check (daily_spend_limit_minor is null or daily_spend_limit_minor >= 0),
  add column if not exists account_timezone text not null default 'UTC',
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists suspended_at timestamptz,
  add column if not exists advertising_purpose text,
  add column if not exists estimated_monthly_spend_minor bigint check (estimated_monthly_spend_minor is null or estimated_monthly_spend_minor >= 0);

alter table public.advertiser_accounts drop constraint if exists advertiser_accounts_billing_status_check;
alter table public.advertiser_accounts
  add constraint advertiser_accounts_billing_status_check
  check (billing_status in ('unconfigured', 'not_configured', 'pending', 'funded', 'payment_required', 'active', 'past_due', 'blocked', 'suspended'));

alter table public.advertiser_accounts drop constraint if exists advertiser_accounts_advertising_status_check;
alter table public.advertiser_accounts
  add constraint advertiser_accounts_advertising_status_check
  check (advertising_status in ('draft', 'pending', 'pending_verification', 'active', 'limited', 'suspended', 'revoked'));

alter table public.advertiser_accounts drop constraint if exists advertiser_accounts_risk_status_check;
alter table public.advertiser_accounts
  add constraint advertiser_accounts_risk_status_check
  check (risk_status in ('unknown', 'normal', 'clear', 'review_required', 'restricted', 'high_risk', 'blocked'));

alter table public.advertiser_account_members drop constraint if exists advertiser_account_members_role_check;
alter table public.advertiser_account_members
  add constraint advertiser_account_members_role_check
  check (role in ('owner', 'advertiser_owner', 'advertiser_admin', 'billing_manager', 'campaign_manager', 'creative_manager', 'analyst', 'compliance_contact'));

create table if not exists public.advertiser_invitations (
  id uuid primary key default gen_random_uuid(),
  advertiser_account_id uuid not null references public.advertiser_accounts(id) on delete restrict,
  invited_email_normalized text not null,
  invited_role text not null check (invited_role in ('advertiser_admin', 'billing_manager', 'campaign_manager', 'creative_manager', 'analyst', 'compliance_contact')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired', 'revoked')),
  invited_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.advertiser_ownership_transfers (
  id uuid primary key default gen_random_uuid(),
  advertiser_account_id uuid not null references public.advertiser_accounts(id) on delete restrict,
  from_user_id uuid not null references public.profiles(id) on delete restrict,
  to_user_id uuid not null references public.profiles(id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

-- ---------------------------------------------------------------------------
-- Campaign / ad set / creative extensions
-- ---------------------------------------------------------------------------
alter table public.ad_campaigns
  add column if not exists advertiser_account_id uuid references public.advertiser_accounts(id) on delete restrict,
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict,
  add column if not exists buying_type text not null default 'fixed_cpm',
  add column if not exists total_budget_minor bigint check (total_budget_minor is null or total_budget_minor >= 0),
  add column if not exists daily_budget_minor bigint check (daily_budget_minor is null or daily_budget_minor >= 0),
  add column if not exists currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  add column if not exists timezone text not null default 'UTC',
  add column if not exists pacing_mode text not null default 'even',
  add column if not exists delivery_status text not null default 'idle',
  add column if not exists funding_source_id uuid,
  add column if not exists creative_snapshot_id uuid,
  add column if not exists source_post_id uuid,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists paused_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists cancelled_at timestamptz;

update public.ad_campaigns set total_budget_minor = coalesce(total_budget_minor, budget_cents) where total_budget_minor is null;

alter table public.ad_campaigns drop constraint if exists ad_campaigns_status_check;
alter table public.ad_campaigns
  add constraint ad_campaigns_status_check
  check (status in (
    'draft', 'submitted', 'in_review', 'requires_changes', 'approved', 'scheduled', 'active',
    'paused', 'budget_exhausted', 'completed', 'rejected', 'suspended', 'cancelled', 'archived'
  ));

alter table public.ad_campaigns drop constraint if exists ad_campaigns_buying_type_check;
alter table public.ad_campaigns
  add constraint ad_campaigns_buying_type_check
  check (buying_type in ('fixed_cpm', 'fixed_cpc', 'reserved', 'internal_sponsorship'));

alter table public.ad_campaigns drop constraint if exists ad_campaigns_pacing_mode_check;
alter table public.ad_campaigns
  add constraint ad_campaigns_pacing_mode_check
  check (pacing_mode in ('even', 'accelerated', 'scheduled'));

alter table public.ad_campaigns drop constraint if exists ad_campaigns_delivery_status_check;
alter table public.ad_campaigns
  add constraint ad_campaigns_delivery_status_check
  check (delivery_status in ('idle', 'scheduled', 'delivering', 'paused', 'exhausted', 'completed', 'blocked'));

alter table public.ad_campaigns drop constraint if exists ad_campaigns_objective_check;
alter table public.ad_campaigns
  add constraint ad_campaigns_objective_check
  check (objective in (
    'awareness', 'reach', 'traffic', 'engagement', 'video_views', 'profile_visits',
    'product_views', 'event_interest', 'app_install', 'lead_generation'
  ));

create table if not exists public.ad_sets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete restrict,
  advertiser_account_id uuid not null references public.advertiser_accounts(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived', 'rejected', 'suspended')),
  bid_strategy text not null default 'fixed' check (bid_strategy in ('fixed')),
  bid_amount_minor bigint check (bid_amount_minor is null or bid_amount_minor >= 0),
  optimization_goal text not null default 'impressions' check (optimization_goal in ('impressions', 'reach', 'clicks', 'engaged_view', 'profile_visit', 'product_view')),
  billing_event text not null default 'impression' check (billing_event in ('impression', 'click', 'video_view', 'reserved_delivery')),
  daily_budget_minor bigint check (daily_budget_minor is null or daily_budget_minor >= 0),
  lifetime_budget_minor bigint check (lifetime_budget_minor is null or lifetime_budget_minor >= 0),
  start_at timestamptz,
  end_at timestamptz,
  frequency_cap_count integer not null default 3 check (frequency_cap_count between 1 and 100),
  frequency_cap_window_seconds integer not null default 86400 check (frequency_cap_window_seconds between 60 and 2592000),
  placement_mode text not null default 'manual' check (placement_mode in ('manual', 'automatic')),
  placement_keys text[] not null default '{}'::text[],
  targeting_spec jsonb not null default '{}'::jsonb check (jsonb_typeof(targeting_spec) = 'object'),
  exclusion_spec jsonb not null default '{}'::jsonb check (jsonb_typeof(exclusion_spec) = 'object'),
  pacing_mode text not null default 'even' check (pacing_mode in ('even', 'accelerated', 'scheduled')),
  delivery_priority integer not null default 100 check (delivery_priority between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at is null or start_at is null or end_at > start_at)
);

create table if not exists public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  advertiser_account_id uuid not null references public.advertiser_accounts(id) on delete restrict,
  campaign_id uuid references public.ad_campaigns(id) on delete restrict,
  ad_set_id uuid references public.ad_sets(id) on delete restrict,
  source_type text not null default 'manual' check (source_type in ('manual', 'business_post', 'business_product', 'creator_content', 'publisher_community')),
  source_id uuid,
  creative_type text not null check (creative_type in (
    'image', 'video', 'sponsored_post', 'product_card', 'carousel', 'event_sponsor',
    'business_profile_card', 'creator_sponsorship', 'publisher_sponsorship'
  )),
  headline text check (headline is null or char_length(headline) <= 120),
  body text check (body is null or char_length(body) <= 2000),
  call_to_action text,
  destination_url text,
  display_domain text,
  media_asset_ids uuid[] not null default '{}'::uuid[],
  product_ids uuid[] not null default '{}'::uuid[],
  locale text not null default 'en',
  disclosure_text text not null default 'Sponsored',
  status text not null default 'draft' check (status in ('draft', 'submitted', 'in_review', 'requires_changes', 'approved', 'rejected', 'suspended', 'archived')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'requires_changes', 'rejected', 'suspended')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ad_creative_snapshots
  add column if not exists campaign_id uuid references public.ad_campaigns(id) on delete restrict,
  add column if not exists ad_set_id uuid references public.ad_sets(id) on delete restrict,
  add column if not exists creative_id uuid references public.ad_creatives(id) on delete restrict,
  add column if not exists creative_version integer not null default 1,
  add column if not exists media_manifest jsonb not null default '[]'::jsonb,
  add column if not exists moderation_decision_id uuid,
  add column if not exists status text not null default 'draft',
  add column if not exists approved_at timestamptz,
  add column if not exists retired_at timestamptz;

alter table public.ad_creative_snapshots drop constraint if exists ad_creative_snapshots_status_check;
alter table public.ad_creative_snapshots
  add constraint ad_creative_snapshots_status_check
  check (status in ('draft', 'submitted', 'approved', 'rejected', 'suspended', 'retired'));

-- Make Business-bridge snapshot columns nullable for general creatives.
alter table public.ad_creative_snapshots
  alter column organization_id drop not null,
  alter column source_post_id drop not null,
  alter column source_post_version drop not null;

-- ---------------------------------------------------------------------------
-- Review decisions (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.ad_review_decisions (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in (
    'advertiser', 'campaign', 'ad_set', 'creative', 'destination', 'product_category', 'sponsorship_disclosure'
  )),
  subject_id uuid not null,
  advertiser_account_id uuid references public.advertiser_accounts(id) on delete restrict,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check (decision in (
    'pending', 'assigned', 'in_review', 'requires_changes', 'approved', 'rejected', 'suspended', 'escalated'
  )),
  public_reason_code text,
  internal_reason_code text,
  policy_version text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (subject_type, subject_id, idempotency_key)
);

-- ---------------------------------------------------------------------------
-- Funding / budget / spend ledger
-- ---------------------------------------------------------------------------
create table if not exists public.advertiser_funding_accounts (
  id uuid primary key default gen_random_uuid(),
  advertiser_account_id uuid not null references public.advertiser_accounts(id) on delete restrict,
  funding_type text not null check (funding_type in (
    'prepaid_balance', 'payment_method', 'invoice_credit', 'promotional_credit', 'internal_sponsorship_credit'
  )),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending', 'active', 'blocked', 'closed')),
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (advertiser_account_id, funding_type, currency)
);

create table if not exists public.advertiser_funding_transactions (
  id uuid primary key default gen_random_uuid(),
  funding_account_id uuid not null references public.advertiser_funding_accounts(id) on delete restrict,
  advertiser_account_id uuid not null references public.advertiser_accounts(id) on delete restrict,
  transaction_type text not null check (transaction_type in (
    'deposit', 'authorization', 'capture', 'refund', 'chargeback', 'credit_grant', 'credit_expiry',
    'manual_adjustment', 'reservation', 'reservation_release', 'spend'
  )),
  status text not null check (status in ('pending', 'authorized', 'settled', 'failed', 'reversed', 'disputed', 'expired')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  is_promotional_credit boolean not null default false,
  correlation_id text,
  idempotency_key text not null,
  metadata_safe jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (advertiser_account_id, idempotency_key)
);

create table if not exists public.campaign_budget_reservations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete restrict,
  funding_account_id uuid not null references public.advertiser_funding_accounts(id) on delete restrict,
  advertiser_account_id uuid not null references public.advertiser_accounts(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  consumed_amount_minor bigint not null default 0 check (consumed_amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in (
    'pending', 'active', 'partially_consumed', 'consumed', 'released', 'expired', 'failed'
  )),
  reserved_at timestamptz,
  released_at timestamptz,
  idempotency_key text not null,
  correlation_id text,
  created_at timestamptz not null default now(),
  check (consumed_amount_minor <= amount_minor),
  unique (campaign_id, idempotency_key)
);

create table if not exists public.ad_spend_ledger (
  id uuid primary key default gen_random_uuid(),
  advertiser_account_id uuid not null references public.advertiser_accounts(id) on delete restrict,
  campaign_id uuid references public.ad_campaigns(id) on delete restrict,
  ad_set_id uuid references public.ad_sets(id) on delete restrict,
  decision_id uuid,
  impression_id uuid,
  click_id uuid,
  reservation_id uuid references public.campaign_budget_reservations(id) on delete restrict,
  entry_type text not null check (entry_type in (
    'impression_charge', 'click_charge', 'video_view_charge', 'reservation_charge',
    'invalid_traffic_reversal', 'refund_adjustment', 'dispute_adjustment', 'manual_adjustment'
  )),
  gross_amount_minor bigint not null check (gross_amount_minor >= 0),
  credit_amount_minor bigint not null default 0 check (credit_amount_minor >= 0),
  cash_amount_minor bigint not null default 0 check (cash_amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'reversed', 'disputed', 'settled')),
  occurred_at timestamptz not null default now(),
  settlement_period text,
  idempotency_key text not null,
  correlation_id text,
  metadata_safe jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (cash_amount_minor + credit_amount_minor = gross_amount_minor),
  unique (advertiser_account_id, idempotency_key)
);

create table if not exists public.advertiser_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  advertiser_account_id uuid not null references public.advertiser_accounts(id) on delete restrict,
  funding_account_id uuid references public.advertiser_funding_accounts(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  available_minor bigint not null check (available_minor >= 0),
  reserved_minor bigint not null check (reserved_minor >= 0),
  spent_minor bigint not null check (spent_minor >= 0),
  computed_at timestamptz not null default now(),
  source text not null default 'ledger_recompute' check (source in ('ledger_recompute', 'manual_audit')),
  correlation_id text
);

-- ---------------------------------------------------------------------------
-- Delivery / events / frequency / preferences
-- ---------------------------------------------------------------------------
create table if not exists public.ad_delivery_decisions (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  user_binding_hash text,
  session_binding_hash text,
  placement_key text not null references public.ad_placements(placement_key) on delete restrict,
  campaign_id uuid references public.ad_campaigns(id) on delete restrict,
  ad_set_id uuid references public.ad_sets(id) on delete restrict,
  snapshot_id uuid references public.ad_creative_snapshots(id) on delete restrict,
  advertiser_account_id uuid references public.advertiser_accounts(id) on delete restrict,
  eligible boolean not null,
  decision_reason text not null,
  internal_reason text,
  pricing_model text,
  billable_rate_minor bigint check (billable_rate_minor is null or billable_rate_minor >= 0),
  currency text,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  token_nonce text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (request_id, placement_key),
  unique (idempotency_key)
);

create table if not exists public.ad_impressions (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.ad_delivery_decisions(id) on delete restrict,
  visibility_policy_version text not null,
  visibility_ratio numeric(5,4) not null check (visibility_ratio >= 0 and visibility_ratio <= 1),
  visible_duration_ms integer not null check (visible_duration_ms >= 0),
  billable boolean not null default false,
  invalid_traffic_status text not null default 'clean' check (invalid_traffic_status in (
    'clean', 'suspected', 'invalid', 'under_review', 'reversed'
  )),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  client_event_id text not null,
  idempotency_key text not null,
  unique (decision_id, client_event_id),
  unique (idempotency_key)
);

create table if not exists public.ad_clicks (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.ad_delivery_decisions(id) on delete restrict,
  billable boolean not null default false,
  invalid_traffic_status text not null default 'clean' check (invalid_traffic_status in (
    'clean', 'suspected', 'invalid', 'under_review', 'reversed'
  )),
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  idempotency_key text not null,
  unique (idempotency_key)
);

create table if not exists public.ad_frequency_counters (
  id uuid primary key default gen_random_uuid(),
  subject_hash text not null,
  campaign_id uuid references public.ad_campaigns(id) on delete restrict,
  ad_set_id uuid references public.ad_sets(id) on delete restrict,
  advertiser_account_id uuid references public.advertiser_accounts(id) on delete restrict,
  placement_key text references public.ad_placements(placement_key) on delete restrict,
  window_start timestamptz not null,
  window_end timestamptz not null,
  impression_count integer not null default 0 check (impression_count >= 0),
  last_impression_at timestamptz,
  unique (subject_hash, campaign_id, ad_set_id, advertiser_account_id, placement_key, window_start)
);

create table if not exists public.user_ad_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  ads_hidden boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_advertiser_blocks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  advertiser_account_id uuid not null references public.advertiser_accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, advertiser_account_id)
);

create table if not exists public.user_ad_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  decision_id uuid references public.ad_delivery_decisions(id) on delete restrict,
  campaign_id uuid references public.ad_campaigns(id) on delete restrict,
  snapshot_id uuid references public.ad_creative_snapshots(id) on delete restrict,
  advertiser_account_id uuid references public.advertiser_accounts(id) on delete restrict,
  action text not null check (action in (
    'hide_this_ad', 'hide_advertiser', 'not_relevant', 'repetitive', 'misleading', 'already_purchased', 'report_ad'
  )),
  report_reason text check (report_reason is null or report_reason in (
    'misleading', 'scam', 'prohibited_product', 'counterfeit', 'unsafe_link', 'malware',
    'undisclosed_sponsorship', 'offensive', 'targeting_concern', 'impersonation', 'other'
  )),
  moderation_case_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.advertiser_conversion_sources (
  id uuid primary key default gen_random_uuid(),
  advertiser_account_id uuid not null references public.advertiser_accounts(id) on delete restrict,
  source_type text not null check (source_type in ('server_to_server', 'signed_web_pixel', 'provider_webhook', 'app_event')),
  name text not null,
  secret_hash text not null check (secret_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'active' check (status in ('active', 'disabled', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ad_conversion_events (
  id uuid primary key default gen_random_uuid(),
  advertiser_account_id uuid not null references public.advertiser_accounts(id) on delete restrict,
  conversion_source_id uuid references public.advertiser_conversion_sources(id) on delete restrict,
  event_name text not null check (event_name in (
    'landing_page_view', 'lead_submitted', 'signup_completed', 'app_install_confirmed',
    'product_view', 'checkout_started', 'purchase'
  )),
  value_minor bigint check (value_minor is null or value_minor >= 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  verification_state text not null default 'unverified' check (verification_state in ('unverified', 'verified', 'rejected')),
  consent_state text not null default 'unknown' check (consent_state in ('unknown', 'granted', 'denied')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  idempotency_key text not null,
  unique (advertiser_account_id, idempotency_key)
);

create table if not exists public.ad_attribution_records (
  id uuid primary key default gen_random_uuid(),
  conversion_event_id uuid not null references public.ad_conversion_events(id) on delete restrict,
  impression_id uuid references public.ad_impressions(id) on delete restrict,
  click_id uuid references public.ad_clicks(id) on delete restrict,
  attribution_model text not null default 'last_click' check (attribution_model in ('last_click', 'last_impression', 'unattributed')),
  attribution_window_seconds integer not null check (attribution_window_seconds > 0),
  confidence_state text not null default 'low' check (confidence_state in ('low', 'medium', 'high')),
  attributed_at timestamptz not null default now(),
  unique (conversion_event_id)
);

create table if not exists public.ad_partner_attributions (
  id uuid primary key default gen_random_uuid(),
  partner_type text not null check (partner_type in ('creator', 'publisher')),
  partner_subject_id uuid not null,
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  campaign_id uuid not null references public.ad_campaigns(id) on delete restrict,
  ad_set_id uuid references public.ad_sets(id) on delete restrict,
  decision_id uuid not null references public.ad_delivery_decisions(id) on delete restrict,
  impression_id uuid references public.ad_impressions(id) on delete restrict,
  click_id uuid references public.ad_clicks(id) on delete restrict,
  placement_key text not null references public.ad_placements(placement_key) on delete restrict,
  contract_id uuid not null references public.revenue_share_contracts(id) on delete restrict,
  gross_ad_revenue_minor bigint not null check (gross_ad_revenue_minor >= 0),
  eligible_revenue_minor bigint not null check (eligible_revenue_minor >= 0),
  platform_share_minor bigint not null check (platform_share_minor >= 0),
  partner_share_minor bigint not null check (partner_share_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  traffic_status text not null default 'clean' check (traffic_status in ('clean', 'suspected', 'invalid', 'under_review', 'reversed')),
  accrual_status text not null default 'pending' check (accrual_status in ('pending', 'held', 'available', 'reversed', 'disputed', 'paid')),
  occurred_at timestamptz not null,
  hold_until timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  check (platform_share_minor + partner_share_minor = eligible_revenue_minor),
  unique (idempotency_key)
);

create table if not exists public.partner_revenue_accruals (
  id uuid primary key default gen_random_uuid(),
  partner_attribution_id uuid not null references public.ad_partner_attributions(id) on delete restrict,
  monetization_account_id uuid not null references public.monetization_accounts(id) on delete restrict,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending', 'held', 'available', 'reversed', 'disputed', 'paid')),
  hold_until timestamptz,
  revenue_ledger_id uuid,
  reconciliation_run_id uuid,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (idempotency_key)
);

create table if not exists public.ad_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  report jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (period_end > period_start),
  unique (period_start, period_end)
);

create table if not exists public.ad_worker_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in (
    'campaign_scheduler', 'campaign_start', 'campaign_end', 'budget_pacing', 'budget_exhaustion',
    'reservation_release', 'invalid_traffic_review', 'spend_settlement', 'revenue_attribution',
    'partner_accrual_hold_release', 'daily_analytics_aggregation', 'stale_delivery_token_cleanup',
    'expired_invitation_cleanup'
  )),
  subject_id uuid,
  status text not null default 'pending' check (status in ('pending', 'claimed', 'completed', 'failed', 'dead_letter')),
  attempts integer not null default 0 check (attempts >= 0),
  lease_expires_at timestamptz,
  last_error text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper / guard functions
-- ---------------------------------------------------------------------------
create or replace function public.ads_touch_updated_at()
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

create or replace function public.ads_prevent_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'ADS_APPEND_ONLY' using errcode = '55000';
end;
$$;

create or replace function public.ads_setting_bool(p_key text, p_default boolean default false)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (setting_value #>> '{}')::boolean from public.ad_platform_settings where setting_key = p_key),
    p_default
  );
$$;

create or replace function public.is_advertiser_member_with_roles(
  target_account_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.advertiser_account_members m
    where m.advertiser_account_id = target_account_id
      and m.user_id = auth.uid()
      and (
        m.role = any (allowed_roles)
        or m.role in ('owner', 'advertiser_owner')
      )
  );
$$;

create or replace function public.ads_sensitive_targeting_keys()
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select array[
    'race', 'ethnicity', 'religion', 'sexual_orientation', 'health_condition',
    'political_belief', 'union_membership', 'precise_geolocation', 'private_message_content',
    'contact_list', 'voice_conversation', 'private_files', 'account_password', 'child_behavioural_profile',
    'financial_hardship', 'criminal_allegation', 'biometric_data', 'retargeting'
  ]::text[];
$$;

create or replace function public.ads_allowed_targeting_keys()
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select array[
    'country', 'region', 'language', 'platform', 'operating_system', 'placement',
    'content_category', 'community_category', 'event_category', 'age_eligibility',
    'contextual_interest', 'followed_business', 'device_class', 'daypart'
  ]::text[];
$$;

create or replace function public.validate_ad_targeting_spec(spec jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  k text;
begin
  if jsonb_typeof(spec) <> 'object' then
    raise exception 'AD_TARGETING_INVALID' using errcode = '22023';
  end if;
  for k in select jsonb_object_keys(spec)
  loop
    if k = any (public.ads_sensitive_targeting_keys()) then
      raise exception 'AD_TARGETING_SENSITIVE_REJECTED' using errcode = '22023';
    end if;
    if not (k = any (public.ads_allowed_targeting_keys())) then
      raise exception 'AD_TARGETING_UNKNOWN_KEY' using errcode = '22023';
    end if;
  end loop;
end;
$$;

create or replace function public.ads_require_active_legal(doc_keys text[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  missing text;
begin
  select d.doc_key into missing
  from unnest(doc_keys) as d(doc_key)
  where not exists (
    select 1 from public.advertising_legal_document_versions b
    where b.document_key = d.doc_key and b.status = 'active'
  )
  limit 1;
  if missing is not null then
    raise exception 'LEGAL_COPY_REQUIRED' using errcode = 'P0001';
  end if;
exception
  when undefined_table then
    raise exception 'LEGAL_COPY_REQUIRED' using errcode = 'P0001';
end;
$$;

create or replace function public.ads_hash_binding(raw_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select encode(extensions.digest(coalesce(raw_value, ''), 'sha256'), 'hex');
$$;

create or replace function public.ads_allow_internal_transition()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $
  select coalesce(nullif(current_setting('picom.ads_internal', true), ''), '') = '1';
$;

-- ---------------------------------------------------------------------------
-- Advertiser onboarding / lifecycle
-- ---------------------------------------------------------------------------
create or replace function public.create_advertiser_account_v2(
  target_owner_type text,
  target_owner_id uuid,
  target_advertiser_type text,
  target_display_name text,
  target_legal_name text default null,
  target_country_code text default null,
  target_billing_currency text default 'USD',
  target_purpose text default null,
  target_estimated_monthly_spend_minor bigint default null,
  target_terms_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account_id uuid;
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if target_owner_type = 'user' and target_owner_id <> actor then
    raise exception 'ADVERTISER_OWNER_FORBIDDEN' using errcode = '42501';
  end if;
  if target_owner_type = 'organization' and not public.has_organization_role(
    target_owner_id, array['organization_owner', 'business_admin', 'billing_admin', 'campaign_manager']
  ) then
    raise exception 'ADVERTISER_OWNER_FORBIDDEN' using errcode = '42501';
  end if;
  if target_owner_type not in ('user', 'organization')
     or target_advertiser_type not in ('individual', 'sole_trader', 'company', 'agency', 'business_partner') then
    raise exception 'ADVERTISER_ACCOUNT_INVALID' using errcode = '22023';
  end if;
  if lower(coalesce(target_purpose, '')) like '%political%' then
    raise exception 'POLITICAL_ADVERTISING_DISABLED' using errcode = '22023';
  end if;

  insert into public.advertiser_accounts (
    owner_type, owner_id, advertiser_type, display_name, legal_name, country_code,
    billing_currency, advertising_status, billing_status, risk_status,
    advertising_purpose, estimated_monthly_spend_minor, terms_version, terms_accepted_at
  ) values (
    target_owner_type, target_owner_id, target_advertiser_type, btrim(target_display_name),
    nullif(btrim(coalesce(target_legal_name, '')), ''),
    nullif(upper(coalesce(target_country_code, '')), ''),
    upper(coalesce(target_billing_currency, 'USD')),
    'draft', 'not_configured', 'normal',
    nullif(btrim(coalesce(target_purpose, '')), ''),
    target_estimated_monthly_spend_minor,
    target_terms_version,
    case when target_terms_version is not null then now() else null end
  )
  returning id into account_id;

  insert into public.advertiser_account_members (advertiser_account_id, user_id, role, created_by)
  values (account_id, actor, 'advertiser_owner', actor);

  return account_id;
end;
$$;

create or replace function public.submit_advertiser_account(target_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform set_config('picom.ads_internal', '1', true);
  if not public.is_advertiser_member_with_roles(target_account_id, array['advertiser_owner', 'owner', 'compliance_contact']) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.advertiser_accounts
  set advertising_status = 'pending_verification',
      verification_status = case when verification_status = 'verified' then verification_status else 'pending' end,
      updated_at = now()
  where id = target_account_id
    and advertising_status in ('draft', 'pending', 'pending_verification')
    and advertising_status not in ('suspended', 'revoked');
  if not found then
    raise exception 'ADVERTISER_SUBMIT_INVALID' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.root_activate_advertiser_account(
  target_account_id uuid,
  public_reason_code text,
  internal_reason_code text,
  policy_version text,
  idempotency_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform set_config('picom.ads_internal', '1', true);
  if not public.verification_business_is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.ad_review_decisions (
    subject_type, subject_id, advertiser_account_id, reviewer_id, decision,
    public_reason_code, internal_reason_code, policy_version, idempotency_key
  ) values (
    'advertiser', target_account_id, target_account_id, auth.uid(), 'approved',
    public_reason_code, internal_reason_code, policy_version, idempotency_key
  )
  on conflict (subject_type, subject_id, idempotency_key) do nothing;

  update public.advertiser_accounts
  set advertising_status = 'active',
      activated_at = coalesce(activated_at, now()),
      risk_status = case when risk_status = 'high_risk' then 'review_required' else risk_status end,
      updated_at = now()
  where id = target_account_id
    and advertising_status in ('pending', 'pending_verification', 'limited', 'draft')
    and risk_status <> 'blocked';
end;
$$;

create or replace function public.root_suspend_advertiser_account(
  target_account_id uuid,
  public_reason_code text,
  internal_reason_code text,
  policy_version text,
  idempotency_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform set_config('picom.ads_internal', '1', true);
  if not public.verification_business_is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.ad_review_decisions (
    subject_type, subject_id, advertiser_account_id, reviewer_id, decision,
    public_reason_code, internal_reason_code, policy_version, idempotency_key
  ) values (
    'advertiser', target_account_id, target_account_id, auth.uid(), 'suspended',
    public_reason_code, internal_reason_code, policy_version, idempotency_key
  )
  on conflict (subject_type, subject_id, idempotency_key) do nothing;

  update public.advertiser_accounts
  set advertising_status = 'suspended', suspended_at = now(), updated_at = now()
  where id = target_account_id;

  update public.ad_campaigns
  set status = 'suspended', delivery_status = 'blocked', paused_at = now(), updated_at = now()
  where advertiser_account_id = target_account_id
    and status in ('active', 'scheduled', 'approved');
end;
$$;

-- Last owner guard
create or replace function public.ads_require_advertiser_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_count integer;
begin
  if tg_op = 'DELETE' and old.role in ('owner', 'advertiser_owner') then
    select count(*) into owner_count
    from public.advertiser_account_members
    where advertiser_account_id = old.advertiser_account_id
      and role in ('owner', 'advertiser_owner')
      and user_id <> old.user_id;
    if owner_count < 1 then
      raise exception 'LAST_ADVERTISER_OWNER' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.role in ('owner', 'advertiser_owner')
     and new.role not in ('owner', 'advertiser_owner') then
    select count(*) into owner_count
    from public.advertiser_account_members
    where advertiser_account_id = old.advertiser_account_id
      and role in ('owner', 'advertiser_owner')
      and user_id <> old.user_id;
    if owner_count < 1 then
      raise exception 'LAST_ADVERTISER_OWNER' using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists ads_require_advertiser_owner on public.advertiser_account_members;
create trigger ads_require_advertiser_owner
  before update or delete on public.advertiser_account_members
  for each row execute function public.ads_require_advertiser_owner_membership();

-- Client cannot self-activate advertiser or write spend limits
create or replace function public.ads_guard_advertiser_account_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and not public.verification_business_is_platform_admin() and not public.ads_allow_internal_transition() then
    if new.advertising_status is distinct from old.advertising_status
       and new.advertising_status in ('active', 'limited')
       and old.advertising_status not in ('active', 'limited') then
      raise exception 'CLIENT_CANNOT_ACTIVATE_ADVERTISER' using errcode = '42501';
    end if;
    if new.spend_limit_minor is distinct from old.spend_limit_minor
       or new.daily_spend_limit_minor is distinct from old.daily_spend_limit_minor then
      raise exception 'CLIENT_CANNOT_SET_SPEND_LIMIT' using errcode = '42501';
    end if;
    if new.risk_status is distinct from old.risk_status then
      raise exception 'CLIENT_CANNOT_SET_RISK' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ads_guard_advertiser_account_write on public.advertiser_accounts;
create trigger ads_guard_advertiser_account_write
  before update on public.advertiser_accounts
  for each row execute function public.ads_guard_advertiser_account_write();

-- ---------------------------------------------------------------------------
-- Campaign / ad set / creative lifecycle
-- ---------------------------------------------------------------------------
create or replace function public.create_ad_campaign(
  target_advertiser_account_id uuid,
  target_name text,
  target_objective text,
  target_buying_type text default 'fixed_cpm',
  target_total_budget_minor bigint default 0,
  target_daily_budget_minor bigint default null,
  target_start_at timestamptz default null,
  target_end_at timestamptz default null,
  target_timezone text default 'UTC',
  target_pacing_mode text default 'even'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account public.advertiser_accounts%rowtype;
  campaign_id uuid;
begin
  if not public.is_advertiser_member_with_roles(
    target_advertiser_account_id,
    array['advertiser_owner', 'owner', 'advertiser_admin', 'campaign_manager']
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into account from public.advertiser_accounts where id = target_advertiser_account_id;
  if not found then
    raise exception 'ADVERTISER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if account.advertising_status in ('suspended', 'revoked') then
    raise exception 'ADVERTISER_SUSPENDED' using errcode = '42501';
  end if;
  if target_objective in ('sales', 'purchase_optimization', 'roas_optimization') then
    raise exception 'CAMPAIGN_OBJECTIVE_DISABLED' using errcode = '22023';
  end if;
  if target_buying_type = 'auction' then
    raise exception 'CAMPAIGN_BUYING_TYPE_DISABLED' using errcode = '22023';
  end if;
  if target_end_at is not null and target_start_at is not null and target_end_at <= target_start_at then
    raise exception 'CAMPAIGN_SCHEDULE_INVALID' using errcode = '22023';
  end if;

  insert into public.ad_campaigns (
    name, advertiser_label, objective, status, review_status, budget_cents, spend_cents,
    advertiser_account_id, buying_type, total_budget_minor, daily_budget_minor, currency,
    timezone, pacing_mode, delivery_status, schedule_start, schedule_end, created_by, updated_by
  ) values (
    btrim(target_name), account.display_name, target_objective, 'draft', 'pending',
    coalesce(target_total_budget_minor, 0), 0,
    target_advertiser_account_id, target_buying_type, coalesce(target_total_budget_minor, 0),
    target_daily_budget_minor, account.billing_currency, coalesce(target_timezone, 'UTC'),
    coalesce(target_pacing_mode, 'even'), 'idle', target_start_at, target_end_at, auth.uid(), auth.uid()
  )
  returning id into campaign_id;
  return campaign_id;
end;
$$;

create or replace function public.create_ad_set(
  target_campaign_id uuid,
  target_name text,
  target_placement_keys text[],
  target_targeting_spec jsonb default '{}'::jsonb,
  target_exclusion_spec jsonb default '{}'::jsonb,
  target_billing_event text default 'impression',
  target_bid_amount_minor bigint default null,
  target_daily_budget_minor bigint default null,
  target_lifetime_budget_minor bigint default null,
  target_frequency_cap_count integer default 3,
  target_frequency_cap_window_seconds integer default 86400,
  target_start_at timestamptz default null,
  target_end_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  campaign public.ad_campaigns%rowtype;
  ad_set_id uuid;
  placement text;
begin
  select * into campaign from public.ad_campaigns where id = target_campaign_id;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not public.is_advertiser_member_with_roles(
    campaign.advertiser_account_id,
    array['advertiser_owner', 'owner', 'advertiser_admin', 'campaign_manager']
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  perform public.validate_ad_targeting_spec(coalesce(target_targeting_spec, '{}'::jsonb));
  perform public.validate_ad_targeting_spec(coalesce(target_exclusion_spec, '{}'::jsonb));
  if target_lifetime_budget_minor is not null
     and campaign.total_budget_minor is not null
     and target_lifetime_budget_minor > campaign.total_budget_minor then
    raise exception 'AD_SET_BUDGET_EXCEEDS_CAMPAIGN' using errcode = '22023';
  end if;
  foreach placement in array coalesce(target_placement_keys, '{}'::text[])
  loop
    if not exists (select 1 from public.ad_placements p where p.placement_key = placement) then
      raise exception 'AD_PLACEMENT_UNKNOWN' using errcode = '22023';
    end if;
  end loop;

  insert into public.ad_sets (
    campaign_id, advertiser_account_id, name, placement_keys, targeting_spec, exclusion_spec,
    billing_event, bid_amount_minor, daily_budget_minor, lifetime_budget_minor,
    frequency_cap_count, frequency_cap_window_seconds, start_at, end_at
  ) values (
    target_campaign_id, campaign.advertiser_account_id, btrim(target_name),
    coalesce(target_placement_keys, '{}'::text[]),
    coalesce(target_targeting_spec, '{}'::jsonb),
    coalesce(target_exclusion_spec, '{}'::jsonb),
    target_billing_event, target_bid_amount_minor, target_daily_budget_minor, target_lifetime_budget_minor,
    coalesce(target_frequency_cap_count, 3), coalesce(target_frequency_cap_window_seconds, 86400),
    target_start_at, target_end_at
  )
  returning id into ad_set_id;
  return ad_set_id;
end;
$$;

create or replace function public.create_ad_creative(
  target_advertiser_account_id uuid,
  target_campaign_id uuid,
  target_ad_set_id uuid,
  target_creative_type text,
  target_headline text default null,
  target_body text default null,
  target_cta text default null,
  target_destination_url text default null,
  target_source_type text default 'manual',
  target_source_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  creative_id uuid;
  display_domain text;
begin
  if not public.is_advertiser_member_with_roles(
    target_advertiser_account_id,
    array['advertiser_owner', 'owner', 'advertiser_admin', 'creative_manager', 'campaign_manager']
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if target_destination_url is not null then
    if target_destination_url !~* '^https://' then
      raise exception 'AD_DESTINATION_HTTPS_REQUIRED' using errcode = '22023';
    end if;
    if target_destination_url ~* '^(javascript|data|file):' then
      raise exception 'AD_DESTINATION_SCHEME_BLOCKED' using errcode = '22023';
    end if;
    display_domain := lower(split_part(split_part(target_destination_url, '://', 2), '/', 1));
  end if;

  insert into public.ad_creatives (
    advertiser_account_id, campaign_id, ad_set_id, creative_type, headline, body, call_to_action,
    destination_url, display_domain, source_type, source_id, created_by, updated_by
  ) values (
    target_advertiser_account_id, target_campaign_id, target_ad_set_id, target_creative_type,
    target_headline, target_body, target_cta, target_destination_url, display_domain,
    coalesce(target_source_type, 'manual'), target_source_id, auth.uid(), auth.uid()
  )
  returning id into creative_id;
  return creative_id;
end;
$$;

create or replace function public.create_ad_creative_snapshot(target_creative_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  creative public.ad_creatives%rowtype;
  payload jsonb;
  snapshot_id uuid;
  version_no integer;
begin
  select * into creative from public.ad_creatives where id = target_creative_id;
  if not found then
    raise exception 'CREATIVE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not public.is_advertiser_member_with_roles(
    creative.advertiser_account_id,
    array['advertiser_owner', 'owner', 'advertiser_admin', 'creative_manager', 'campaign_manager']
  ) and not public.verification_business_is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select coalesce(max(creative_version), 0) + 1 into version_no
  from public.ad_creative_snapshots
  where creative_id = target_creative_id;

  payload := jsonb_build_object(
    'creative_id', creative.id,
    'creative_type', creative.creative_type,
    'headline', creative.headline,
    'body', creative.body,
    'call_to_action', creative.call_to_action,
    'destination_url', creative.destination_url,
    'display_domain', creative.display_domain,
    'disclosure_text', creative.disclosure_text,
    'locale', creative.locale,
    'media_asset_ids', to_jsonb(creative.media_asset_ids),
    'product_ids', to_jsonb(creative.product_ids),
    'version', version_no
  );

  insert into public.ad_creative_snapshots (
    advertiser_account_id, organization_id, source_post_id, source_post_version,
    snapshot_payload, snapshot_hash, destination_url, destination_domain, created_by,
    campaign_id, ad_set_id, creative_id, creative_version, media_manifest, status
  ) values (
    creative.advertiser_account_id, null, null, null,
    payload,
    encode(extensions.digest(payload::text, 'sha256'), 'hex'),
    creative.destination_url, creative.display_domain, auth.uid(),
    creative.campaign_id, creative.ad_set_id, creative.id, version_no,
    coalesce(to_jsonb(creative.media_asset_ids), '[]'::jsonb), 'draft'
  )
  returning id into snapshot_id;
  return snapshot_id;
end;
$$;

create or replace function public.submit_ad_campaign(target_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  campaign public.ad_campaigns%rowtype;
begin
  perform set_config('picom.ads_internal', '1', true);
  select * into campaign from public.ad_campaigns where id = target_campaign_id for update;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not public.is_advertiser_member_with_roles(
    campaign.advertiser_account_id,
    array['advertiser_owner', 'owner', 'advertiser_admin', 'campaign_manager']
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if campaign.status not in ('draft', 'requires_changes') then
    raise exception 'CAMPAIGN_SUBMIT_INVALID_STATE' using errcode = 'P0001';
  end if;
  if lower(coalesce(campaign.objective, '')) like '%political%' then
    raise exception 'POLITICAL_ADVERTISING_DISABLED' using errcode = '22023';
  end if;
  begin
    perform public.ads_require_active_legal(array[
      'advertising_terms', 'advertising_content_policy', 'sponsored_content_policy', 'prohibited_products_policy'
    ]);
  exception
    when others then
      if sqlerrm like '%LEGAL_COPY_REQUIRED%' then
        raise exception 'LEGAL_COPY_REQUIRED' using errcode = 'P0001';
      end if;
      raise exception 'LEGAL_COPY_REQUIRED' using errcode = 'P0001';
  end;

  update public.ad_campaigns
  set status = 'submitted', review_status = 'pending', submitted_at = now(), updated_by = auth.uid(), updated_at = now()
  where id = target_campaign_id;
end;
$$;

create or replace function public.root_approve_ad_campaign(
  target_campaign_id uuid,
  public_reason_code text,
  internal_reason_code text,
  policy_version text,
  idempotency_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform set_config('picom.ads_internal', '1', true);
  if not public.verification_business_is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.ad_review_decisions (
    subject_type, subject_id, advertiser_account_id, reviewer_id, decision,
    public_reason_code, internal_reason_code, policy_version, idempotency_key
  )
  select 'campaign', c.id, c.advertiser_account_id, auth.uid(), 'approved',
         public_reason_code, internal_reason_code, policy_version, idempotency_key
  from public.ad_campaigns c where c.id = target_campaign_id
  on conflict (subject_type, subject_id, idempotency_key) do nothing;

  update public.ad_campaigns
  set status = 'approved', review_status = 'approved', approved_at = now(), updated_at = now()
  where id = target_campaign_id
    and status in ('submitted', 'in_review', 'requires_changes');
end;
$$;

create or replace function public.root_reject_ad_campaign(
  target_campaign_id uuid,
  public_reason_code text,
  internal_reason_code text,
  policy_version text,
  idempotency_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform set_config('picom.ads_internal', '1', true);
  if not public.verification_business_is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.ad_review_decisions (
    subject_type, subject_id, advertiser_account_id, reviewer_id, decision,
    public_reason_code, internal_reason_code, policy_version, idempotency_key
  )
  select 'campaign', c.id, c.advertiser_account_id, auth.uid(), 'rejected',
         public_reason_code, internal_reason_code, policy_version, idempotency_key
  from public.ad_campaigns c where c.id = target_campaign_id
  on conflict (subject_type, subject_id, idempotency_key) do nothing;

  update public.ad_campaigns
  set status = 'rejected', review_status = 'rejected', updated_at = now()
  where id = target_campaign_id;
end;
$$;

create or replace function public.root_approve_ad_creative(
  target_creative_id uuid,
  target_snapshot_id uuid,
  public_reason_code text,
  internal_reason_code text,
  policy_version text,
  idempotency_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  creative public.ad_creatives%rowtype;
begin
  perform set_config('picom.ads_internal', '1', true);
  if not public.verification_business_is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into creative from public.ad_creatives where id = target_creative_id;
  if not found then
    raise exception 'CREATIVE_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.ad_review_decisions (
    subject_type, subject_id, advertiser_account_id, reviewer_id, decision,
    public_reason_code, internal_reason_code, policy_version, idempotency_key
  ) values (
    'creative', target_creative_id, creative.advertiser_account_id, auth.uid(), 'approved',
    public_reason_code, internal_reason_code, policy_version, idempotency_key
  )
  on conflict (subject_type, subject_id, idempotency_key) do nothing;

  update public.ad_creatives
  set status = 'approved', moderation_status = 'approved', updated_at = now(), updated_by = auth.uid()
  where id = target_creative_id;

  -- Snapshot rows are append-only: retire via new status requires allowing status updates by admin trigger bypass.
  -- Approved marker is stored on creative + review decision; delivery uses snapshot status via service role path below.
end;
$$;

-- Guard: clients cannot mark campaign active / creative approved directly
create or replace function public.ads_guard_campaign_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and not public.verification_business_is_platform_admin() and not public.ads_allow_internal_transition() then
    if new.status is distinct from old.status and new.status in ('active', 'approved', 'scheduled') then
      raise exception 'CLIENT_CANNOT_ACTIVATE_CAMPAIGN' using errcode = '42501';
    end if;
    if new.review_status is distinct from old.review_status and new.review_status = 'approved' then
      raise exception 'CLIENT_CANNOT_APPROVE_REVIEW' using errcode = '42501';
    end if;
    if new.spend_cents is distinct from old.spend_cents then
      raise exception 'CLIENT_CANNOT_WRITE_SPEND' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ads_guard_campaign_write on public.ad_campaigns;
create trigger ads_guard_campaign_write
  before update on public.ad_campaigns
  for each row execute function public.ads_guard_campaign_write();

create or replace function public.ads_guard_creative_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and not public.verification_business_is_platform_admin() and not public.ads_allow_internal_transition() then
    if new.moderation_status is distinct from old.moderation_status and new.moderation_status = 'approved' then
      raise exception 'CLIENT_CANNOT_APPROVE_CREATIVE' using errcode = '42501';
    end if;
    if new.status is distinct from old.status and new.status = 'approved' then
      raise exception 'CLIENT_CANNOT_APPROVE_CREATIVE' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ads_guard_creative_write on public.ad_creatives;
create trigger ads_guard_creative_write
  before update on public.ad_creatives
  for each row execute function public.ads_guard_creative_write();

-- ---------------------------------------------------------------------------
-- Funding / reservation / spend
-- ---------------------------------------------------------------------------
create or replace function public.compute_advertiser_available_balance_minor(
  target_advertiser_account_id uuid,
  target_currency text
)
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  credits bigint := 0;
  debits bigint := 0;
begin
  select coalesce(sum(
    case
      when transaction_type in ('deposit', 'capture', 'credit_grant', 'manual_adjustment', 'reservation_release')
           and status = 'settled' then amount_minor
      else 0
    end
  ), 0) into credits
  from public.advertiser_funding_transactions
  where advertiser_account_id = target_advertiser_account_id
    and currency = target_currency;

  select coalesce(sum(
    case
      when transaction_type in ('reservation', 'spend', 'refund', 'chargeback', 'credit_expiry')
           and status in ('settled', 'authorized') then amount_minor
      else 0
    end
  ), 0) into debits
  from public.advertiser_funding_transactions
  where advertiser_account_id = target_advertiser_account_id
    and currency = target_currency;

  return greatest(credits - debits, 0);
end;
$$;

create or replace function public.reserve_campaign_budget(
  target_campaign_id uuid,
  target_funding_account_id uuid,
  target_amount_minor bigint,
  target_idempotency_key text,
  target_correlation_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  campaign public.ad_campaigns%rowtype;
  funding public.advertiser_funding_accounts%rowtype;
  available bigint;
  reservation_id uuid;
begin
  select * into campaign from public.ad_campaigns where id = target_campaign_id for update;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not public.is_advertiser_member_with_roles(
    campaign.advertiser_account_id,
    array['advertiser_owner', 'owner', 'billing_manager']
  ) and not public.verification_business_is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if campaign.status not in ('approved', 'scheduled', 'paused') then
    raise exception 'CAMPAIGN_RESERVATION_INVALID_STATE' using errcode = 'P0001';
  end if;

  select * into funding from public.advertiser_funding_accounts
  where id = target_funding_account_id and advertiser_account_id = campaign.advertiser_account_id
  for update;
  if not found or funding.status <> 'active' then
    raise exception 'FUNDING_ACCOUNT_INVALID' using errcode = 'P0001';
  end if;
  if funding.currency <> campaign.currency then
    raise exception 'CURRENCY_MISMATCH' using errcode = '22023';
  end if;

  select id into reservation_id
  from public.campaign_budget_reservations
  where campaign_id = target_campaign_id and idempotency_key = target_idempotency_key;
  if found then
    return reservation_id;
  end if;

  available := public.compute_advertiser_available_balance_minor(campaign.advertiser_account_id, campaign.currency);
  if available < target_amount_minor then
    raise exception 'INSUFFICIENT_FUNDS' using errcode = 'P0001';
  end if;

  insert into public.campaign_budget_reservations (
    campaign_id, funding_account_id, advertiser_account_id, amount_minor, currency,
    status, reserved_at, idempotency_key, correlation_id
  ) values (
    target_campaign_id, target_funding_account_id, campaign.advertiser_account_id, target_amount_minor,
    campaign.currency, 'active', now(), target_idempotency_key, target_correlation_id
  )
  returning id into reservation_id;

  insert into public.advertiser_funding_transactions (
    funding_account_id, advertiser_account_id, transaction_type, status, amount_minor, currency,
    idempotency_key, correlation_id
  ) values (
    target_funding_account_id, campaign.advertiser_account_id, 'reservation', 'settled',
    target_amount_minor, campaign.currency, 'reservation:' || target_idempotency_key, target_correlation_id
  );

  update public.ad_campaigns
  set funding_source_id = target_funding_account_id, updated_at = now()
  where id = target_campaign_id;

  return reservation_id;
end;
$$;

create or replace function public.release_campaign_budget(
  target_campaign_id uuid,
  target_idempotency_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reservation public.campaign_budget_reservations%rowtype;
  remaining bigint;
begin
  select * into reservation
  from public.campaign_budget_reservations
  where campaign_id = target_campaign_id
    and status in ('active', 'partially_consumed')
  order by reserved_at desc
  limit 1
  for update;
  if not found then
    return;
  end if;
  if not public.is_advertiser_member_with_roles(
    reservation.advertiser_account_id,
    array['advertiser_owner', 'owner', 'billing_manager']
  ) and not public.verification_business_is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  remaining := reservation.amount_minor - reservation.consumed_amount_minor;
  update public.campaign_budget_reservations
  set status = case when reservation.consumed_amount_minor = 0 then 'released' else 'released' end,
      released_at = now()
  where id = reservation.id;

  if remaining > 0 then
    insert into public.advertiser_funding_transactions (
      funding_account_id, advertiser_account_id, transaction_type, status, amount_minor, currency,
      idempotency_key, correlation_id
    ) values (
      reservation.funding_account_id, reservation.advertiser_account_id, 'reservation_release', 'settled',
      remaining, reservation.currency, target_idempotency_key, reservation.correlation_id
    )
    on conflict (advertiser_account_id, idempotency_key) do nothing;
  end if;
end;
$$;

create or replace function public.activate_ad_campaign(target_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  campaign public.ad_campaigns%rowtype;
  account public.advertiser_accounts%rowtype;
  reservation_exists boolean;
begin
  perform set_config('picom.ads_internal', '1', true);
  select * into campaign from public.ad_campaigns where id = target_campaign_id for update;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not public.is_advertiser_member_with_roles(
    campaign.advertiser_account_id,
    array['advertiser_owner', 'owner', 'advertiser_admin', 'campaign_manager']
  ) and not public.verification_business_is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into account from public.advertiser_accounts where id = campaign.advertiser_account_id;
  if account.advertising_status <> 'active' then
    raise exception 'ADVERTISER_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  if campaign.status not in ('approved', 'scheduled', 'paused') then
    raise exception 'CAMPAIGN_ACTIVATE_INVALID_STATE' using errcode = 'P0001';
  end if;
  if campaign.review_status <> 'approved' then
    raise exception 'CAMPAIGN_REVIEW_REQUIRED' using errcode = 'P0001';
  end if;
  if not public.ads_setting_bool('advertising_enabled', true)
     or public.ads_setting_bool('advertising_global_kill_switch', false) then
    raise exception 'ADVERTISING_DISABLED' using errcode = 'P0001';
  end if;
  select exists (
    select 1 from public.campaign_budget_reservations r
    where r.campaign_id = target_campaign_id and r.status in ('active', 'partially_consumed')
  ) into reservation_exists;
  if not reservation_exists then
    raise exception 'BUDGET_RESERVATION_REQUIRED' using errcode = 'P0001';
  end if;

  if campaign.schedule_start is not null and campaign.schedule_start > now() then
    update public.ad_campaigns
    set status = 'scheduled', delivery_status = 'scheduled', updated_at = now()
    where id = target_campaign_id;
  else
    update public.ad_campaigns
    set status = 'active', delivery_status = 'delivering', activated_at = coalesce(activated_at, now()), updated_at = now()
    where id = target_campaign_id;
  end if;
end;
$$;

create or replace function public.pause_ad_campaign(target_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform set_config('picom.ads_internal', '1', true);
  update public.ad_campaigns c
  set status = 'paused', delivery_status = 'paused', paused_at = now(), updated_at = now(), updated_by = auth.uid()
  where c.id = target_campaign_id
    and c.status in ('active', 'scheduled')
    and (
      public.is_advertiser_member_with_roles(c.advertiser_account_id, array['advertiser_owner', 'owner', 'advertiser_admin', 'campaign_manager'])
      or public.verification_business_is_platform_admin()
    );
  if not found then
    raise exception 'CAMPAIGN_PAUSE_INVALID' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.record_ad_spend_charge(
  target_advertiser_account_id uuid,
  target_campaign_id uuid,
  target_ad_set_id uuid,
  target_decision_id uuid,
  target_impression_id uuid,
  target_click_id uuid,
  target_entry_type text,
  target_amount_minor bigint,
  target_currency text,
  target_idempotency_key text,
  target_correlation_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reservation public.campaign_budget_reservations%rowtype;
  ledger_id uuid;
  remaining bigint;
begin
  perform set_config('picom.ads_internal', '1', true);
  if target_amount_minor <= 0 then
    raise exception 'SPEND_AMOUNT_INVALID' using errcode = '22023';
  end if;

  select id into ledger_id
  from public.ad_spend_ledger
  where advertiser_account_id = target_advertiser_account_id
    and idempotency_key = target_idempotency_key;
  if found then
    return ledger_id;
  end if;

  select * into reservation
  from public.campaign_budget_reservations
  where campaign_id = target_campaign_id
    and status in ('active', 'partially_consumed')
  order by reserved_at desc
  limit 1
  for update;

  if not found then
    raise exception 'NO_ACTIVE_RESERVATION' using errcode = 'P0001';
  end if;
  remaining := reservation.amount_minor - reservation.consumed_amount_minor;
  if remaining < target_amount_minor then
    update public.ad_campaigns
    set status = 'budget_exhausted', delivery_status = 'exhausted', updated_at = now()
    where id = target_campaign_id;
    raise exception 'BUDGET_EXHAUSTED' using errcode = 'P0001';
  end if;

  update public.campaign_budget_reservations
  set consumed_amount_minor = consumed_amount_minor + target_amount_minor,
      status = case
        when consumed_amount_minor + target_amount_minor >= amount_minor then 'consumed'
        else 'partially_consumed'
      end
  where id = reservation.id;

  insert into public.ad_spend_ledger (
    advertiser_account_id, campaign_id, ad_set_id, decision_id, impression_id, click_id, reservation_id,
    entry_type, gross_amount_minor, credit_amount_minor, cash_amount_minor, currency, status,
    idempotency_key, correlation_id
  ) values (
    target_advertiser_account_id, target_campaign_id, target_ad_set_id, target_decision_id,
    target_impression_id, target_click_id, reservation.id, target_entry_type,
    target_amount_minor, 0, target_amount_minor, target_currency, 'confirmed',
    target_idempotency_key, target_correlation_id
  )
  returning id into ledger_id;

  insert into public.advertiser_funding_transactions (
    funding_account_id, advertiser_account_id, transaction_type, status, amount_minor, currency,
    idempotency_key, correlation_id
  ) values (
    reservation.funding_account_id, target_advertiser_account_id, 'spend', 'settled',
    target_amount_minor, target_currency, 'spend:' || target_idempotency_key, target_correlation_id
  )
  on conflict (advertiser_account_id, idempotency_key) do nothing;

  update public.ad_campaigns
  set spend_cents = spend_cents + target_amount_minor,
      updated_at = now()
  where id = target_campaign_id;

  if (select amount_minor - consumed_amount_minor from public.campaign_budget_reservations where id = reservation.id) = 0 then
    update public.ad_campaigns
    set status = 'budget_exhausted', delivery_status = 'exhausted', updated_at = now()
    where id = target_campaign_id;
  end if;

  return ledger_id;
end;
$$;

create or replace function public.reverse_invalid_ad_spend(
  target_spend_ledger_id uuid,
  target_idempotency_key text,
  public_reason_code text default 'invalid_traffic',
  internal_reason_code text default 'invalid_traffic_reversal'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  entry public.ad_spend_ledger%rowtype;
  reversal_id uuid;
begin
  perform set_config('picom.ads_internal', '1', true);
  if not public.verification_business_is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into entry from public.ad_spend_ledger where id = target_spend_ledger_id;
  if not found then
    raise exception 'SPEND_NOT_FOUND' using errcode = 'P0002';
  end if;

  select id into reversal_id from public.ad_spend_ledger
  where advertiser_account_id = entry.advertiser_account_id and idempotency_key = target_idempotency_key;
  if found then
    return reversal_id;
  end if;

  insert into public.ad_spend_ledger (
    advertiser_account_id, campaign_id, ad_set_id, decision_id, impression_id, click_id, reservation_id,
    entry_type, gross_amount_minor, credit_amount_minor, cash_amount_minor, currency, status,
    idempotency_key, correlation_id, metadata_safe
  ) values (
    entry.advertiser_account_id, entry.campaign_id, entry.ad_set_id, entry.decision_id,
    entry.impression_id, entry.click_id, entry.reservation_id, 'invalid_traffic_reversal',
    entry.gross_amount_minor, entry.credit_amount_minor, entry.cash_amount_minor, entry.currency,
    'confirmed', target_idempotency_key, entry.correlation_id,
    jsonb_build_object('public_reason_code', public_reason_code, 'internal_reason_code', internal_reason_code, 'reverses', entry.id)
  )
  returning id into reversal_id;

  if entry.reservation_id is not null then
    update public.campaign_budget_reservations
    set consumed_amount_minor = greatest(consumed_amount_minor - entry.gross_amount_minor, 0),
        status = 'partially_consumed'
    where id = entry.reservation_id;
  end if;

  return reversal_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Delivery engine
-- ---------------------------------------------------------------------------
create or replace function public.resolve_ad_delivery(
  target_user_id uuid,
  anonymous_session_id text,
  target_placement text,
  target_context jsonb default '{}'::jsonb,
  target_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_key text := coalesce(nullif(btrim(coalesce(target_request_id, '')), ''), gen_random_uuid()::text);
  placement public.ad_placements%rowtype;
  eligibility jsonb;
  existing public.ad_delivery_decisions%rowtype;
  candidate record;
  user_hash text;
  session_hash text;
  decision_id uuid;
  expires_at timestamptz := now() + interval '5 minutes';
  nonce text := encode(extensions.gen_random_bytes(16), 'hex');
  public_dto jsonb;
  explanation_factors text[] := '{}'::text[];
begin
  if not public.ads_setting_bool('advertising_enabled', true)
     or public.ads_setting_bool('advertising_global_kill_switch', false) then
    return jsonb_build_object('eligible', false, 'reason', 'advertising_disabled', 'request_id', request_key);
  end if;

  select * into placement from public.ad_placements where placement_key = target_placement;
  if not found or not placement.enabled then
    return jsonb_build_object('eligible', false, 'reason', 'placement_disabled', 'request_id', request_key);
  end if;

  select * into existing
  from public.ad_delivery_decisions
  where request_id = request_key and placement_key = target_placement;
  if found then
    return jsonb_build_object(
      'eligible', existing.eligible,
      'reason', existing.decision_reason,
      'decision_id', existing.id,
      'request_id', request_key,
      'expires_at', existing.expires_at
    );
  end if;

  if target_user_id is not null then
    eligibility := public.resolve_ad_eligibility(
      target_user_id,
      target_placement,
      coalesce(target_context, '{}'::jsonb) || jsonb_build_object('contentKind', 'sponsored')
    );
    if coalesce(eligibility ->> 'eligible', 'false') <> 'true' then
      insert into public.ad_delivery_decisions (
        request_id, user_binding_hash, session_binding_hash, placement_key, eligible,
        decision_reason, internal_reason, issued_at, expires_at, token_nonce, idempotency_key
      ) values (
        request_key,
        public.ads_hash_binding(target_user_id::text),
        public.ads_hash_binding(anonymous_session_id),
        target_placement, false,
        coalesce(eligibility ->> 'reason', 'ineligible'),
        eligibility ->> 'internal_reason',
        now(), expires_at, nonce, 'decision:' || request_key || ':' || target_placement
      )
      returning id into decision_id;
      return jsonb_build_object(
        'eligible', false,
        'reason', coalesce(eligibility ->> 'reason', 'ineligible'),
        'decision_id', decision_id,
        'request_id', request_key
      );
    end if;

    if exists (select 1 from public.user_ad_preferences p where p.user_id = target_user_id and p.ads_hidden) then
      return jsonb_build_object('eligible', false, 'reason', 'user_ads_hidden', 'request_id', request_key);
    end if;
  end if;

  user_hash := public.ads_hash_binding(coalesce(target_user_id::text, ''));
  session_hash := public.ads_hash_binding(coalesce(anonymous_session_id, ''));

  for candidate in
    select c.id as campaign_id, s.id as ad_set_id, snap.id as snapshot_id, c.advertiser_account_id,
           s.bid_amount_minor, s.delivery_priority, s.frequency_cap_count, s.frequency_cap_window_seconds,
           c.buying_type, c.currency, aa.display_name as advertiser_name,
           snap.snapshot_payload, snap.destination_domain, snap.destination_url,
           s.targeting_spec, s.exclusion_spec
    from public.ad_campaigns c
    join public.ad_sets s on s.campaign_id = c.id and s.status = 'active'
    join public.ad_creative_snapshots snap on snap.campaign_id = c.id
    join public.advertiser_accounts aa on aa.id = c.advertiser_account_id
    join public.ad_creatives cr on cr.id = snap.creative_id and cr.status = 'approved' and cr.moderation_status = 'approved'
    where c.status = 'active'
      and c.delivery_status = 'delivering'
      and aa.advertising_status = 'active'
      and aa.risk_status not in ('blocked', 'high_risk')
      and (c.schedule_start is null or c.schedule_start <= now())
      and (c.schedule_end is null or c.schedule_end > now())
      and (target_placement = any (s.placement_keys) or cardinality(s.placement_keys) = 0)
      and exists (
        select 1 from public.campaign_budget_reservations r
        where r.campaign_id = c.id and r.status in ('active', 'partially_consumed')
          and r.consumed_amount_minor < r.amount_minor
      )
      and (
        target_user_id is null
        or not exists (
          select 1 from public.user_advertiser_blocks b
          where b.user_id = target_user_id and b.advertiser_account_id = c.advertiser_account_id
        )
      )
      and (
        target_user_id is null
        or not exists (
          select 1 from public.user_ad_feedback f
          where f.user_id = target_user_id
            and f.action = 'hide_this_ad'
            and (f.campaign_id = c.id or f.snapshot_id = snap.id)
        )
      )
    order by s.delivery_priority desc, c.created_at asc
  loop
    -- Frequency cap
    if exists (
      select 1 from public.ad_frequency_counters fc
      where fc.subject_hash = coalesce(nullif(user_hash, public.ads_hash_binding('')), session_hash)
        and fc.campaign_id = candidate.campaign_id
        and fc.window_end > now()
        and fc.impression_count >= candidate.frequency_cap_count
    ) then
      continue;
    end if;

    explanation_factors := array['sponsored_content'];
    if candidate.targeting_spec ? 'country' then
      explanation_factors := explanation_factors || array['country'];
    end if;
    if candidate.targeting_spec ? 'language' then
      explanation_factors := explanation_factors || array['language'];
    end if;
    if candidate.targeting_spec ? 'content_category' then
      explanation_factors := explanation_factors || array['content_category'];
    end if;

    insert into public.ad_delivery_decisions (
      request_id, user_binding_hash, session_binding_hash, placement_key,
      campaign_id, ad_set_id, snapshot_id, advertiser_account_id, eligible,
      decision_reason, pricing_model, billable_rate_minor, currency,
      issued_at, expires_at, token_nonce, idempotency_key
    ) values (
      request_key, user_hash, session_hash, target_placement,
      candidate.campaign_id, candidate.ad_set_id, candidate.snapshot_id, candidate.advertiser_account_id, true,
      'selected', candidate.buying_type, candidate.bid_amount_minor, candidate.currency,
      now(), expires_at, nonce, 'decision:' || request_key || ':' || target_placement
    )
    returning id into decision_id;

    public_dto := jsonb_build_object(
      'sponsored', true,
      'label', 'Sponsored',
      'advertiser_name', candidate.advertiser_name,
      'headline', candidate.snapshot_payload ->> 'headline',
      'body', candidate.snapshot_payload ->> 'body',
      'call_to_action', candidate.snapshot_payload ->> 'call_to_action',
      'destination_domain', candidate.destination_domain,
      'placement', target_placement,
      'decision_id', decision_id,
      'snapshot_id', candidate.snapshot_id,
      'explanation_factors', to_jsonb(explanation_factors)
    );

    return jsonb_build_object(
      'eligible', true,
      'reason', 'selected',
      'request_id', request_key,
      'decision_id', decision_id,
      'expires_at', expires_at,
      'token_nonce', nonce,
      'creative', public_dto
    );
  end loop;

  insert into public.ad_delivery_decisions (
    request_id, user_binding_hash, session_binding_hash, placement_key, eligible,
    decision_reason, issued_at, expires_at, token_nonce, idempotency_key
  ) values (
    request_key, user_hash, session_hash, target_placement, false,
    'no_eligible_candidate', now(), expires_at, nonce, 'decision:' || request_key || ':' || target_placement
  )
  returning id into decision_id;

  return jsonb_build_object(
    'eligible', false,
    'reason', 'no_eligible_candidate',
    'decision_id', decision_id,
    'request_id', request_key
  );
end;
$$;

create or replace function public.record_ad_impression(
  target_decision_id uuid,
  target_visibility_ratio numeric,
  target_visible_duration_ms integer,
  target_client_event_id text,
  target_user_id uuid default null,
  target_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  decision public.ad_delivery_decisions%rowtype;
  existing public.ad_impressions%rowtype;
  impression_id uuid;
  billable boolean := false;
  min_ratio numeric := 0.5;
  min_ms integer := 1000;
  binding_ok boolean;
begin
  select * into decision from public.ad_delivery_decisions where id = target_decision_id;
  if not found then
    raise exception 'DECISION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not decision.eligible or decision.campaign_id is null then
    raise exception 'DECISION_NOT_BILLABLE' using errcode = 'P0001';
  end if;
  if decision.expires_at < now() then
    raise exception 'DELIVERY_TOKEN_EXPIRED' using errcode = 'P0001';
  end if;

  binding_ok := (
    (target_user_id is null and decision.user_binding_hash = public.ads_hash_binding(''))
    or (target_user_id is not null and decision.user_binding_hash = public.ads_hash_binding(target_user_id::text))
  ) and (
    target_session_id is null
    or decision.session_binding_hash = public.ads_hash_binding(target_session_id)
  );
  if not binding_ok then
    raise exception 'DELIVERY_BINDING_MISMATCH' using errcode = '42501';
  end if;

  select * into existing
  from public.ad_impressions
  where decision_id = target_decision_id and client_event_id = target_client_event_id;
  if found then
    return jsonb_build_object('impression_id', existing.id, 'billable', existing.billable, 'duplicate', true);
  end if;

  billable := target_visibility_ratio >= min_ratio and target_visible_duration_ms >= min_ms;

  insert into public.ad_impressions (
    decision_id, visibility_policy_version, visibility_ratio, visible_duration_ms,
    billable, invalid_traffic_status, occurred_at, client_event_id, idempotency_key
  ) values (
    target_decision_id, 'v1_50pct_1s', target_visibility_ratio, target_visible_duration_ms,
    billable, 'clean', now(), target_client_event_id, 'imp:' || target_decision_id::text || ':' || target_client_event_id
  )
  returning id into impression_id;

  if billable and decision.pricing_model = 'fixed_cpm' and coalesce(decision.billable_rate_minor, 0) > 0 then
    perform public.record_ad_spend_charge(
      decision.advertiser_account_id, decision.campaign_id, decision.ad_set_id, decision.id,
      impression_id, null, 'impression_charge',
      greatest(div(coalesce(decision.billable_rate_minor, 0), 1000), 1),
      coalesce(decision.currency, 'USD'),
      'spend:imp:' || impression_id::text,
      decision.id::text
    );
  end if;

  insert into public.ad_frequency_counters (
    subject_hash, campaign_id, ad_set_id, advertiser_account_id, placement_key,
    window_start, window_end, impression_count, last_impression_at
  ) values (
    coalesce(nullif(decision.user_binding_hash, public.ads_hash_binding('')), decision.session_binding_hash),
    decision.campaign_id, decision.ad_set_id, decision.advertiser_account_id, decision.placement_key,
    now(), now() + interval '24 hours', 1, now()
  )
  on conflict (subject_hash, campaign_id, ad_set_id, advertiser_account_id, placement_key, window_start)
  do update set impression_count = public.ad_frequency_counters.impression_count + 1,
                last_impression_at = now();

  update public.ad_campaigns set impressions = impressions + 1, updated_at = now() where id = decision.campaign_id;

  return jsonb_build_object('impression_id', impression_id, 'billable', billable, 'duplicate', false);
end;
$$;

create or replace function public.record_ad_click(
  target_decision_id uuid,
  target_idempotency_key text,
  target_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  decision public.ad_delivery_decisions%rowtype;
  snapshot public.ad_creative_snapshots%rowtype;
  click_id uuid;
  existing uuid;
begin
  select * into decision from public.ad_delivery_decisions where id = target_decision_id;
  if not found or not decision.eligible then
    raise exception 'DECISION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if decision.expires_at < now() then
    raise exception 'DELIVERY_TOKEN_EXPIRED' using errcode = 'P0001';
  end if;
  if target_user_id is not null and decision.user_binding_hash <> public.ads_hash_binding(target_user_id::text) then
    raise exception 'DELIVERY_BINDING_MISMATCH' using errcode = '42501';
  end if;

  select id into existing from public.ad_clicks where idempotency_key = target_idempotency_key;
  if found then
    select destination_url into snapshot.destination_url from public.ad_creative_snapshots where id = decision.snapshot_id;
    return jsonb_build_object('click_id', existing, 'duplicate', true, 'destination_url', snapshot.destination_url);
  end if;

  select * into snapshot from public.ad_creative_snapshots where id = decision.snapshot_id;
  if not found or snapshot.destination_url is null or snapshot.destination_url !~* '^https://' then
    raise exception 'DESTINATION_BLOCKED' using errcode = 'P0001';
  end if;

  insert into public.ad_clicks (decision_id, billable, invalid_traffic_status, idempotency_key)
  values (target_decision_id, true, 'clean', target_idempotency_key)
  returning id into click_id;

  if decision.pricing_model = 'fixed_cpc' and coalesce(decision.billable_rate_minor, 0) > 0 then
    perform public.record_ad_spend_charge(
      decision.advertiser_account_id, decision.campaign_id, decision.ad_set_id, decision.id,
      null, click_id, 'click_charge', coalesce(decision.billable_rate_minor, 0),
      coalesce(decision.currency, 'USD'), 'spend:click:' || click_id::text, decision.id::text
    );
  end if;

  update public.ad_campaigns set clicks = clicks + 1, updated_at = now() where id = decision.campaign_id;

  return jsonb_build_object(
    'click_id', click_id,
    'duplicate', false,
    'destination_url', snapshot.destination_url,
    'destination_domain', snapshot.destination_domain
  );
end;
$$;

create or replace function public.get_ad_decision_explanation(target_decision_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  decision public.ad_delivery_decisions%rowtype;
  advertiser_name text;
  factors text[] := array['This is sponsored content.'];
begin
  select * into decision from public.ad_delivery_decisions where id = target_decision_id;
  if not found then
    raise exception 'DECISION_NOT_FOUND' using errcode = 'P0002';
  end if;
  select display_name into advertiser_name from public.advertiser_accounts where id = decision.advertiser_account_id;

  return jsonb_build_object(
    'decision_id', decision.id,
    'sponsored', true,
    'advertiser_name', advertiser_name,
    'placement', decision.placement_key,
    'reasons', to_jsonb(factors || array[
      'Shown based on broad location, language, or content category signals when available.',
      'PICOM does not use sensitive attributes such as race, religion, health, or political belief for targeting.'
    ]),
    'actions', jsonb_build_array('hide_this_ad', 'hide_advertiser', 'report_ad', 'about_advertiser')
  );
end;
$$;

create or replace function public.hide_ad_decision(target_decision_id uuid, target_action text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  decision public.ad_delivery_decisions%rowtype;
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  select * into decision from public.ad_delivery_decisions where id = target_decision_id;
  if not found then
    raise exception 'DECISION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if target_action not in ('hide_this_ad', 'hide_advertiser', 'not_relevant', 'repetitive', 'misleading', 'already_purchased') then
    raise exception 'AD_FEEDBACK_INVALID' using errcode = '22023';
  end if;

  insert into public.user_ad_feedback (
    user_id, decision_id, campaign_id, snapshot_id, advertiser_account_id, action
  ) values (
    actor, decision.id, decision.campaign_id, decision.snapshot_id, decision.advertiser_account_id, target_action
  );

  if target_action = 'hide_advertiser' and decision.advertiser_account_id is not null then
    insert into public.user_advertiser_blocks (user_id, advertiser_account_id)
    values (actor, decision.advertiser_account_id)
    on conflict do nothing;
  end if;
end;
$$;

create or replace function public.report_ad_decision(
  target_decision_id uuid,
  target_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  decision public.ad_delivery_decisions%rowtype;
  actor uuid := auth.uid();
  feedback_id uuid;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  select * into decision from public.ad_delivery_decisions where id = target_decision_id;
  if not found then
    raise exception 'DECISION_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.user_ad_feedback (
    user_id, decision_id, campaign_id, snapshot_id, advertiser_account_id, action, report_reason
  ) values (
    actor, decision.id, decision.campaign_id, decision.snapshot_id, decision.advertiser_account_id, 'report_ad', target_reason
  )
  returning id into feedback_id;
  return feedback_id;
end;
$$;

create or replace function public.root_toggle_ad_placement(target_placement_key text, target_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.verification_business_is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.ad_placements
  set enabled = target_enabled, updated_at = now()
  where placement_key = target_placement_key;
  if not found then
    raise exception 'AD_PLACEMENT_UNKNOWN' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.root_toggle_advertising_global(target_disabled boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.verification_business_is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.ad_platform_settings (setting_key, setting_value, updated_by, updated_at)
  values ('advertising_global_kill_switch', to_jsonb(target_disabled), auth.uid(), now())
  on conflict (setting_key) do update
    set setting_value = excluded.setting_value, updated_by = excluded.updated_by, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Partner attribution + reconciliation
-- ---------------------------------------------------------------------------
create or replace function public.attribute_partner_ad_revenue(
  target_decision_id uuid,
  target_impression_id uuid,
  target_partner_type text,
  target_partner_subject_id uuid,
  target_monetization_account_id uuid,
  target_contract_id uuid,
  target_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  decision public.ad_delivery_decisions%rowtype;
  impression public.ad_impressions%rowtype;
  monetization public.monetization_accounts%rowtype;
  contract public.revenue_share_contracts%rowtype;
  spend public.ad_spend_ledger%rowtype;
  attribution_id uuid;
  eligible bigint;
  platform_share bigint;
  partner_share bigint;
  hold_days integer;
begin
  if not public.verification_business_is_platform_admin() and auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select id into attribution_id from public.ad_partner_attributions where idempotency_key = target_idempotency_key;
  if found then
    return attribution_id;
  end if;

  select * into decision from public.ad_delivery_decisions where id = target_decision_id;
  select * into impression from public.ad_impressions where id = target_impression_id;
  if not found or not impression.billable or impression.invalid_traffic_status <> 'clean' then
    raise exception 'PARTNER_ATTRIBUTION_INVALID_TRAFFIC' using errcode = 'P0001';
  end if;

  select * into monetization from public.monetization_accounts where id = target_monetization_account_id;
  if monetization.monetization_status <> 'active' or monetization.compliance_status <> 'clear' then
    raise exception 'PARTNER_MONETIZATION_INACTIVE' using errcode = 'P0001';
  end if;
  -- Self-traffic: partner cannot be an advertiser member on the same account.
  if exists (
    select 1 from public.advertiser_account_members m
    where m.advertiser_account_id = decision.advertiser_account_id
      and m.user_id = target_partner_subject_id
  ) then
    raise exception 'PARTNER_SELF_TRAFFIC' using errcode = 'P0001';
  end if;

  select * into contract from public.revenue_share_contracts where id = target_contract_id and status = 'active';
  if not found then
    raise exception 'REVENUE_CONTRACT_INACTIVE' using errcode = 'P0001';
  end if;

  select * into spend
  from public.ad_spend_ledger
  where impression_id = target_impression_id
    and entry_type in ('impression_charge', 'click_charge')
    and status = 'confirmed'
  order by created_at desc
  limit 1;
  if not found then
    raise exception 'PARTNER_NO_CONFIRMED_SPEND' using errcode = 'P0001';
  end if;

  eligible := spend.cash_amount_minor;
  platform_share := floor(eligible * contract.platform_percentage / 100.0)::bigint;
  partner_share := eligible - platform_share;

  hold_days := greatest(coalesce(contract.hold_period_days, 7), 0);

  insert into public.ad_partner_attributions (
    partner_type, partner_subject_id, monetization_account_id, campaign_id, ad_set_id,
    decision_id, impression_id, placement_key, contract_id,
    gross_ad_revenue_minor, eligible_revenue_minor, platform_share_minor, partner_share_minor,
    currency, traffic_status, accrual_status, occurred_at, hold_until, idempotency_key
  ) values (
    target_partner_type, target_partner_subject_id, target_monetization_account_id,
    decision.campaign_id, decision.ad_set_id, decision.id, impression.id, decision.placement_key, contract.id,
    spend.gross_amount_minor, eligible, platform_share, partner_share,
    spend.currency, 'clean', 'held', impression.occurred_at, now() + make_interval(days => hold_days),
    target_idempotency_key
  )
  returning id into attribution_id;

  insert into public.partner_revenue_accruals (
    partner_attribution_id, monetization_account_id, amount_minor, currency, status, hold_until, idempotency_key
  ) values (
    attribution_id, target_monetization_account_id, partner_share, spend.currency, 'held',
    now() + make_interval(days => hold_days), 'accrual:' || target_idempotency_key
  );

  return attribution_id;
end;
$$;

create or replace function public.reconcile_ad_revenue_period(
  period_start timestamptz,
  period_end timestamptz,
  target_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  run_id uuid;
  processed integer := 0;
begin
  if not public.verification_business_is_platform_admin() and auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not public.ads_setting_bool('ad_reconciliation_enabled', false) then
    raise exception 'AD_RECONCILIATION_DISABLED' using errcode = 'P0001';
  end if;

  insert into public.ad_reconciliation_runs (period_start, period_end, status, created_by)
  values (period_start, period_end, 'running', auth.uid())
  on conflict (period_start, period_end) do update
    set status = 'running'
  returning id into run_id;

  update public.partner_revenue_accruals a
  set status = 'available'
  where a.status = 'held'
    and a.hold_until is not null
    and a.hold_until <= now()
    and a.created_at >= period_start
    and a.created_at < period_end;

  get diagnostics processed = row_count;

  -- Append partner amounts into existing revenue_ledger without mutating prior rows.
  insert into public.revenue_ledger (
    monetization_account_id, earning_period_start, earning_period_end,
    gross_revenue_minor, invalid_traffic_deduction_minor, refund_adjustment_minor,
    platform_share_minor, partner_share_minor, tax_withholding_minor, net_payable_minor,
    currency, contract_id, status, correlation_id, idempotency_key
  )
  select
    a.monetization_account_id,
    period_start,
    period_end,
    pa.eligible_revenue_minor,
    0,
    0,
    pa.platform_share_minor,
    a.amount_minor,
    0,
    a.amount_minor,
    a.currency,
    pa.contract_id,
    'held',
    'reconcile:' || run_id::text,
    'reconcile:' || run_id::text || ':' || a.id::text
  from public.partner_revenue_accruals a
  join public.ad_partner_attributions pa on pa.id = a.partner_attribution_id
  where a.status = 'available'
    and a.reconciliation_run_id is null
    and a.created_at >= period_start
    and a.created_at < period_end
  on conflict (idempotency_key) do nothing;

  update public.partner_revenue_accruals a
  set reconciliation_run_id = run_id
  where a.status = 'available'
    and a.reconciliation_run_id is null
    and a.created_at >= period_start
    and a.created_at < period_end;

  update public.ad_reconciliation_runs
  set status = 'completed',
      completed_at = now(),
      report = jsonb_build_object('processed_accruals', processed, 'idempotency_key', target_idempotency_key)
  where id = run_id;

  return run_id;
exception
  when others then
    if run_id is not null then
      update public.ad_reconciliation_runs
      set status = 'failed', report = jsonb_build_object('error', sqlerrm)
      where id = run_id;
    end if;
    raise;
end;
$$;

-- ---------------------------------------------------------------------------
-- Append-only triggers + legal seed
-- ---------------------------------------------------------------------------
drop trigger if exists ads_spend_ledger_append_only on public.ad_spend_ledger;
create trigger ads_spend_ledger_append_only
  before update or delete on public.ad_spend_ledger
  for each row execute function public.ads_prevent_mutation();

drop trigger if exists ads_funding_tx_append_only on public.advertiser_funding_transactions;
create trigger ads_funding_tx_append_only
  before update or delete on public.advertiser_funding_transactions
  for each row execute function public.ads_prevent_mutation();

drop trigger if exists ads_review_decisions_append_only on public.ad_review_decisions;
create trigger ads_review_decisions_append_only
  before update or delete on public.ad_review_decisions
  for each row execute function public.ads_prevent_mutation();

drop trigger if exists ads_partner_attr_append_only on public.ad_partner_attributions;
create trigger ads_partner_attr_append_only
  before update or delete on public.ad_partner_attributions
  for each row execute function public.ads_prevent_mutation();

drop trigger if exists ads_partner_accrual_no_delete on public.partner_revenue_accruals;
create trigger ads_partner_accrual_no_delete
  before delete on public.partner_revenue_accruals
  for each row execute function public.ads_prevent_mutation();

create table if not exists public.advertising_legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_key text not null check (document_key in (
    'advertising_terms', 'advertiser_account_terms', 'advertising_content_policy', 'sponsored_content_policy',
    'prohibited_products_policy', 'invalid_traffic_policy', 'billing_refund_policy',
    'creator_monetization_agreement', 'publisher_monetization_agreement', 'revenue_share_policy',
    'conversion_tracking_notice', 'advertising_privacy_notice', 'business_partner_terms', 'appeal_complaint_procedure'
  )),
  version text not null check (char_length(btrim(version)) between 1 and 80),
  content_hash text,
  status text not null default 'draft' check (status in ('draft', 'pending_legal', 'active', 'superseded', 'retired')),
  effective_at timestamptz,
  created_at timestamptz not null default now(),
  unique (document_key, version)
);

insert into public.advertising_legal_document_versions (document_key, version, status)
values
  ('advertising_terms', 'v1-draft', 'pending_legal'),
  ('advertiser_account_terms', 'v1-draft', 'pending_legal'),
  ('advertising_content_policy', 'v1-draft', 'pending_legal'),
  ('sponsored_content_policy', 'v1-draft', 'pending_legal'),
  ('prohibited_products_policy', 'v1-draft', 'pending_legal'),
  ('invalid_traffic_policy', 'v1-draft', 'pending_legal'),
  ('billing_refund_policy', 'v1-draft', 'pending_legal'),
  ('creator_monetization_agreement', 'v1-draft', 'pending_legal'),
  ('publisher_monetization_agreement', 'v1-draft', 'pending_legal'),
  ('revenue_share_policy', 'v1-draft', 'pending_legal'),
  ('conversion_tracking_notice', 'v1-draft', 'pending_legal'),
  ('advertising_privacy_notice', 'v1-draft', 'pending_legal'),
  ('business_partner_terms', 'v1-draft', 'pending_legal'),
  ('appeal_complaint_procedure', 'v1-draft', 'pending_legal')
on conflict (document_key, version) do nothing;

-- Move legal table creation earlier is handled above; ensure RLS + grants.

alter table public.ad_platform_settings enable row level security;
alter table public.ad_placements enable row level security;
alter table public.advertiser_invitations enable row level security;
alter table public.advertiser_ownership_transfers enable row level security;
alter table public.ad_sets enable row level security;
alter table public.ad_creatives enable row level security;
alter table public.ad_review_decisions enable row level security;
alter table public.advertiser_funding_accounts enable row level security;
alter table public.advertiser_funding_transactions enable row level security;
alter table public.campaign_budget_reservations enable row level security;
alter table public.ad_spend_ledger enable row level security;
alter table public.advertiser_balance_snapshots enable row level security;
alter table public.ad_delivery_decisions enable row level security;
alter table public.ad_impressions enable row level security;
alter table public.ad_clicks enable row level security;
alter table public.ad_frequency_counters enable row level security;
alter table public.user_ad_preferences enable row level security;
alter table public.user_advertiser_blocks enable row level security;
alter table public.user_ad_feedback enable row level security;
alter table public.advertiser_conversion_sources enable row level security;
alter table public.ad_conversion_events enable row level security;
alter table public.ad_attribution_records enable row level security;
alter table public.ad_partner_attributions enable row level security;
alter table public.partner_revenue_accruals enable row level security;
alter table public.ad_reconciliation_runs enable row level security;
alter table public.ad_worker_jobs enable row level security;
alter table public.advertising_legal_document_versions enable row level security;

revoke all on table
  public.ad_platform_settings, public.ad_placements, public.advertiser_invitations,
  public.advertiser_ownership_transfers, public.ad_sets, public.ad_creatives, public.ad_review_decisions,
  public.advertiser_funding_accounts, public.advertiser_funding_transactions, public.campaign_budget_reservations,
  public.ad_spend_ledger, public.advertiser_balance_snapshots, public.ad_delivery_decisions,
  public.ad_impressions, public.ad_clicks, public.ad_frequency_counters, public.user_ad_preferences,
  public.user_advertiser_blocks, public.user_ad_feedback, public.advertiser_conversion_sources,
  public.ad_conversion_events, public.ad_attribution_records, public.ad_partner_attributions,
  public.partner_revenue_accruals, public.ad_reconciliation_runs, public.ad_worker_jobs,
  public.advertising_legal_document_versions
from public, anon;

revoke all on table
  public.ad_platform_settings, public.advertiser_invitations, public.advertiser_ownership_transfers,
  public.ad_review_decisions, public.advertiser_funding_transactions, public.campaign_budget_reservations,
  public.ad_spend_ledger, public.advertiser_balance_snapshots, public.ad_delivery_decisions,
  public.ad_impressions, public.ad_clicks, public.ad_frequency_counters, public.advertiser_conversion_sources,
  public.ad_conversion_events, public.ad_attribution_records, public.ad_partner_attributions,
  public.partner_revenue_accruals, public.ad_reconciliation_runs, public.ad_worker_jobs
from authenticated;

-- Member read policies (no client writes to financial/event tables)
create policy ads_placements_authenticated_select on public.ad_placements
  for select to authenticated using (true);

create policy ads_sets_member_select on public.ad_sets
  for select to authenticated
  using (public.is_advertiser_account_member(advertiser_account_id) or public.verification_business_is_platform_admin());

create policy ads_creatives_member_select on public.ad_creatives
  for select to authenticated
  using (public.is_advertiser_account_member(advertiser_account_id) or public.verification_business_is_platform_admin());

create policy ads_funding_accounts_billing_select on public.advertiser_funding_accounts
  for select to authenticated
  using (
    public.is_advertiser_member_with_roles(advertiser_account_id, array['advertiser_owner', 'owner', 'billing_manager', 'advertiser_admin'])
    or public.verification_business_is_platform_admin()
  );

create policy ads_spend_ledger_billing_select on public.ad_spend_ledger
  for select to authenticated
  using (
    public.is_advertiser_member_with_roles(advertiser_account_id, array['advertiser_owner', 'owner', 'billing_manager', 'advertiser_admin', 'analyst'])
    or public.verification_business_is_platform_admin()
  );

create policy ads_user_prefs_own on public.user_ad_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy ads_user_blocks_own on public.user_advertiser_blocks
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy ads_user_feedback_own_select on public.user_ad_feedback
  for select to authenticated
  using (user_id = auth.uid() or public.verification_business_is_platform_admin());

create policy ads_partner_accrual_subject_select on public.partner_revenue_accruals
  for select to authenticated
  using (
    exists (
      select 1 from public.monetization_accounts m
      where m.id = monetization_account_id and m.subject_id = auth.uid()
    )
    or public.verification_business_is_platform_admin()
  );

create policy ads_legal_versions_select on public.advertising_legal_document_versions
  for select to authenticated using (true);

create policy ads_admin_settings_select on public.ad_platform_settings
  for select to authenticated using (public.verification_business_is_platform_admin());

-- Revoke execute from PUBLIC/anon on all ads functions; grant selectively
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'ads_touch_updated_at()',
    'ads_prevent_mutation()',
    'ads_guard_advertiser_account_write()',
    'ads_guard_campaign_write()',
    'ads_guard_creative_write()',
    'ads_require_advertiser_owner_membership()'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
  end loop;
end $$;

revoke all on function public.ads_setting_bool(text, boolean) from public, anon;
revoke all on function public.is_advertiser_member_with_roles(uuid, text[]) from public, anon;
revoke all on function public.validate_ad_targeting_spec(jsonb) from public, anon;
revoke all on function public.ads_require_active_legal(text[]) from public, anon;
revoke all on function public.ads_hash_binding(text) from public, anon;
revoke all on function public.create_advertiser_account_v2(text, uuid, text, text, text, text, text, text, bigint, text) from public, anon;
revoke all on function public.submit_advertiser_account(uuid) from public, anon;
revoke all on function public.root_activate_advertiser_account(uuid, text, text, text, text) from public, anon;
revoke all on function public.root_suspend_advertiser_account(uuid, text, text, text, text) from public, anon;
revoke all on function public.create_ad_campaign(uuid, text, text, text, bigint, bigint, timestamptz, timestamptz, text, text) from public, anon;
revoke all on function public.create_ad_set(uuid, text, text[], jsonb, jsonb, text, bigint, bigint, bigint, integer, integer, timestamptz, timestamptz) from public, anon;
revoke all on function public.create_ad_creative(uuid, uuid, uuid, text, text, text, text, text, text, uuid) from public, anon;
revoke all on function public.create_ad_creative_snapshot(uuid) from public, anon;
revoke all on function public.submit_ad_campaign(uuid) from public, anon;
revoke all on function public.root_approve_ad_campaign(uuid, text, text, text, text) from public, anon;
revoke all on function public.root_reject_ad_campaign(uuid, text, text, text, text) from public, anon;
revoke all on function public.root_approve_ad_creative(uuid, uuid, text, text, text, text) from public, anon;
revoke all on function public.compute_advertiser_available_balance_minor(uuid, text) from public, anon;
revoke all on function public.reserve_campaign_budget(uuid, uuid, bigint, text, text) from public, anon;
revoke all on function public.release_campaign_budget(uuid, text) from public, anon;
revoke all on function public.activate_ad_campaign(uuid) from public, anon;
revoke all on function public.pause_ad_campaign(uuid) from public, anon;
revoke all on function public.record_ad_spend_charge(uuid, uuid, uuid, uuid, uuid, uuid, text, bigint, text, text, text) from public, anon;
revoke all on function public.reverse_invalid_ad_spend(uuid, text, text, text) from public, anon;
revoke all on function public.resolve_ad_delivery(uuid, text, text, jsonb, text) from public, anon;
revoke all on function public.record_ad_impression(uuid, numeric, integer, text, uuid, text) from public, anon;
revoke all on function public.record_ad_click(uuid, text, uuid) from public, anon;
revoke all on function public.get_ad_decision_explanation(uuid) from public, anon;
revoke all on function public.hide_ad_decision(uuid, text) from public, anon;
revoke all on function public.report_ad_decision(uuid, text) from public, anon;
revoke all on function public.root_toggle_ad_placement(text, boolean) from public, anon;
revoke all on function public.root_toggle_advertising_global(boolean) from public, anon;
revoke all on function public.attribute_partner_ad_revenue(uuid, uuid, text, uuid, uuid, uuid, text) from public, anon;
revoke all on function public.reconcile_ad_revenue_period(timestamptz, timestamptz, text) from public, anon;

grant execute on function public.create_advertiser_account_v2(text, uuid, text, text, text, text, text, text, bigint, text) to authenticated;
grant execute on function public.submit_advertiser_account(uuid) to authenticated;
grant execute on function public.create_ad_campaign(uuid, text, text, text, bigint, bigint, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.create_ad_set(uuid, text, text[], jsonb, jsonb, text, bigint, bigint, bigint, integer, integer, timestamptz, timestamptz) to authenticated;
grant execute on function public.create_ad_creative(uuid, uuid, uuid, text, text, text, text, text, text, uuid) to authenticated;
grant execute on function public.create_ad_creative_snapshot(uuid) to authenticated;
grant execute on function public.submit_ad_campaign(uuid) to authenticated;
grant execute on function public.reserve_campaign_budget(uuid, uuid, bigint, text, text) to authenticated;
grant execute on function public.release_campaign_budget(uuid, text) to authenticated;
grant execute on function public.activate_ad_campaign(uuid) to authenticated;
grant execute on function public.pause_ad_campaign(uuid) to authenticated;
grant execute on function public.resolve_ad_delivery(uuid, text, text, jsonb, text) to authenticated;
grant execute on function public.record_ad_impression(uuid, numeric, integer, text, uuid, text) to authenticated;
grant execute on function public.record_ad_click(uuid, text, uuid) to authenticated;
grant execute on function public.get_ad_decision_explanation(uuid) to authenticated;
grant execute on function public.hide_ad_decision(uuid, text) to authenticated;
grant execute on function public.report_ad_decision(uuid, text) to authenticated;
grant execute on function public.compute_advertiser_available_balance_minor(uuid, text) to authenticated;
grant execute on function public.is_advertiser_member_with_roles(uuid, text[]) to authenticated;
grant execute on function public.validate_ad_targeting_spec(jsonb) to authenticated;

grant execute on function public.root_activate_advertiser_account(uuid, text, text, text, text) to authenticated;
grant execute on function public.root_suspend_advertiser_account(uuid, text, text, text, text) to authenticated;
grant execute on function public.root_approve_ad_campaign(uuid, text, text, text, text) to authenticated;
grant execute on function public.root_reject_ad_campaign(uuid, text, text, text, text) to authenticated;
grant execute on function public.root_approve_ad_creative(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.root_toggle_ad_placement(text, boolean) to authenticated;
grant execute on function public.root_toggle_advertising_global(boolean) to authenticated;
grant execute on function public.reverse_invalid_ad_spend(uuid, text, text, text) to authenticated;
grant execute on function public.attribute_partner_ad_revenue(uuid, uuid, text, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.reconcile_ad_revenue_period(timestamptz, timestamptz, text) to authenticated;

-- service_role retains full access by default in Supabase

commit;
