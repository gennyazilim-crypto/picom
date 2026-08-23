-- PICOM Business product catalog, brand content, and organic→sponsored promotion bridge.
-- Additive only: extends foundation tables; no DROP TABLE; no history rewrite of prior migrations.
begin;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Product column extensions (preserve existing rows)
-- ---------------------------------------------------------------------------
alter table public.business_products
  add column if not exists brand_name text,
  add column if not exists manufacturer_name text,
  add column if not exists external_reference text,
  add column if not exists price_display_mode text not null default 'fixed_price',
  add column if not exists availability_text text,
  add column if not exists documentation_url text,
  add column if not exists age_restriction text,
  add column if not exists country_availability_mode text not null default 'global',
  add column if not exists moderation_reason_public text,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists submitted_for_review_at timestamptz,
  add column if not exists unpublished_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists featured_sort integer not null default 0 check (featured_sort >= 0);

update public.business_products
set price_display_mode = case
  when price_amount_minor is null then 'not_displayed'
  else coalesce(nullif(price_display_mode, ''), 'fixed_price')
end
where price_display_mode is null or price_display_mode = '';

alter table public.business_products
  drop constraint if exists business_products_price_display_mode_check;
alter table public.business_products
  add constraint business_products_price_display_mode_check
  check (price_display_mode in ('fixed_price', 'starting_from', 'price_range', 'contact_for_price', 'free', 'not_displayed'));

alter table public.business_products
  drop constraint if exists business_products_country_availability_mode_check;
alter table public.business_products
  add constraint business_products_country_availability_mode_check
  check (country_availability_mode in ('global', 'allowlist', 'blocklist'));

alter table public.business_products drop constraint if exists business_products_product_type_check;
alter table public.business_products
  add constraint business_products_product_type_check
  check (product_type in (
    'physical_product', 'digital_product', 'service', 'subscription', 'event', 'software', 'game',
    'application', 'membership', 'course', 'ticket', 'other'
  ));

alter table public.business_products drop constraint if exists business_products_availability_check;
alter table public.business_products
  add constraint business_products_availability_check
  check (availability in (
    'available', 'preorder', 'pre_order', 'limited', 'out_of_stock', 'discontinued', 'coming_soon', 'unavailable'
  ));

alter table public.business_products drop constraint if exists business_products_moderation_status_check;
alter table public.business_products
  add constraint business_products_moderation_status_check
  check (moderation_status in ('pending', 'approved', 'requires_changes', 'rejected', 'suspended', 'not_required'));

-- ---------------------------------------------------------------------------
-- Collection / media / post extensions
-- ---------------------------------------------------------------------------
alter table public.business_product_collections
  add column if not exists cover_asset_id uuid references public.brand_assets(id) on delete set null,
  add column if not exists visibility text not null default 'public',
  add column if not exists sort_order integer not null default 0 check (sort_order >= 0),
  add column if not exists published_at timestamptz;

alter table public.business_product_collections
  drop constraint if exists business_product_collections_visibility_check;
alter table public.business_product_collections
  add constraint business_product_collections_visibility_check
  check (visibility in ('public', 'unlisted', 'private'));

alter table public.business_product_media
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists file_size bigint check (file_size is null or file_size > 0),
  add column if not exists width integer check (width is null or width > 0),
  add column if not exists height integer check (height is null or height > 0),
  add column if not exists duration_ms integer check (duration_ms is null or duration_ms >= 0),
  add column if not exists sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  add column if not exists caption text,
  add column if not exists upload_status text not null default 'uploaded',
  add column if not exists processing_status text not null default 'pending',
  add column if not exists malware_scan_status text not null default 'pending',
  add column if not exists moderation_status text not null default 'pending',
  add column if not exists is_primary boolean not null default false,
  add column if not exists uploaded_by uuid references public.profiles(id) on delete set null,
  add column if not exists processed_at timestamptz,
  add column if not exists archived_at timestamptz;

alter table public.business_product_media drop constraint if exists business_product_media_media_type_check;
alter table public.business_product_media
  add constraint business_product_media_media_type_check
  check (media_type in (
    'image', 'video', 'document', 'product_image', 'gallery_image', 'product_video',
    'demo_video', 'specification_image', 'downloadable_preview', 'thumbnail'
  ));

alter table public.business_product_media
  drop constraint if exists business_product_media_upload_status_check;
alter table public.business_product_media
  add constraint business_product_media_upload_status_check
  check (upload_status in ('pending', 'uploaded', 'failed', 'archived'));

alter table public.business_product_media
  drop constraint if exists business_product_media_processing_status_check;
alter table public.business_product_media
  add constraint business_product_media_processing_status_check
  check (processing_status in ('pending', 'processing', 'ready', 'failed', 'blocked'));

alter table public.business_product_media
  drop constraint if exists business_product_media_malware_scan_status_check;
alter table public.business_product_media
  add constraint business_product_media_malware_scan_status_check
  check (malware_scan_status in ('pending', 'scanning', 'clean', 'infected', 'failed'));

alter table public.business_product_media
  drop constraint if exists business_product_media_moderation_status_check;
alter table public.business_product_media
  add constraint business_product_media_moderation_status_check
  check (moderation_status in ('pending', 'approved', 'rejected', 'quarantined'));

create unique index if not exists business_product_media_one_primary_uidx
  on public.business_product_media (product_id)
  where is_primary = true and archived_at is null;

alter table public.business_posts
  add column if not exists locale text not null default 'en',
  add column if not exists visibility text not null default 'public',
  add column if not exists publishing_status text,
  add column if not exists moderation_status text not null default 'pending',
  add column if not exists commercial_disclosure_state text not null default 'organic',
  add column if not exists scheduled_for timestamptz,
  add column if not exists edited_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists moderation_reason_public text;

update public.business_posts
set publishing_status = case status
  when 'draft' then 'draft'
  when 'published' then 'published'
  when 'archived' then 'archived'
  else coalesce(publishing_status, 'draft')
end
where publishing_status is null;

alter table public.business_posts
  alter column publishing_status set default 'draft',
  alter column publishing_status set not null;

alter table public.business_posts drop constraint if exists business_posts_post_type_check;
alter table public.business_posts
  add constraint business_posts_post_type_check
  check (post_type in (
    'brand_update', 'product_announcement', 'product_launch', 'offer', 'discount', 'event',
    'case_study', 'video', 'poll', 'job_posting', 'service_announcement', 'company_news',
    'sponsored_content', 'sponsored_content_source'
  ));

alter table public.business_posts drop constraint if exists business_posts_visibility_check;
alter table public.business_posts
  add constraint business_posts_visibility_check
  check (visibility in ('public', 'unlisted', 'followers'));

alter table public.business_posts drop constraint if exists business_posts_publishing_status_check;
alter table public.business_posts
  add constraint business_posts_publishing_status_check
  check (publishing_status in ('draft', 'scheduled', 'published', 'unlisted', 'archived'));

alter table public.business_posts drop constraint if exists business_posts_moderation_status_check;
alter table public.business_posts
  add constraint business_posts_moderation_status_check
  check (moderation_status in ('pending', 'approved', 'requires_changes', 'rejected', 'suspended'));

alter table public.business_posts drop constraint if exists business_posts_commercial_disclosure_state_check;
alter table public.business_posts
  add constraint business_posts_commercial_disclosure_state_check
  check (commercial_disclosure_state in (
    'organic', 'promotion_requested', 'promotion_snapshot_created', 'sponsored_delivery_active', 'promotion_completed'
  ));

-- Keep organic identity: sponsorship_state must stay organic for brand posts unless already campaign_managed/sponsored historically.
-- Promote flow must NOT flip sponsorship_state on the source post.

alter table public.business_post_products
  add column if not exists display_variant_id uuid,
  add column if not exists custom_cta text;

alter table public.ad_campaigns
  add column if not exists advertiser_account_id uuid references public.advertiser_accounts(id) on delete restrict,
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict,
  add column if not exists creative_snapshot_id uuid,
  add column if not exists source_post_id uuid references public.business_posts(id) on delete restrict,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

-- ---------------------------------------------------------------------------
-- New catalog / promotion / analytics tables
-- ---------------------------------------------------------------------------
create table if not exists public.business_product_localizations (
  product_id uuid not null references public.business_products(id) on delete restrict,
  locale text not null check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  name text not null check (char_length(btrim(name)) between 2 and 240),
  short_description text not null default '' check (char_length(short_description) <= 500),
  description text not null default '' check (char_length(description) <= 20000),
  availability_text text,
  seo_title text,
  seo_description text,
  translation_status text not null default 'draft' check (translation_status in ('draft', 'machine', 'human_reviewed', 'published')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, locale)
);

create table if not exists public.business_product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.business_products(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists business_product_options_name_uidx
  on public.business_product_options (product_id, lower(name));

create table if not exists public.business_product_option_values (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.business_product_options(id) on delete restrict,
  product_id uuid not null references public.business_products(id) on delete restrict,
  value text not null check (char_length(btrim(value)) between 1 and 80),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists business_product_option_values_value_uidx
  on public.business_product_option_values (option_id, lower(value));

create table if not exists public.business_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.business_products(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  sku text,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  price_amount_minor bigint check (price_amount_minor is null or price_amount_minor >= 0),
  compare_at_price_amount_minor bigint check (compare_at_price_amount_minor is null or compare_at_price_amount_minor >= 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  availability text not null default 'available' check (availability in (
    'available', 'preorder', 'pre_order', 'limited', 'out_of_stock', 'discontinued', 'coming_soon', 'unavailable'
  )),
  external_purchase_url text,
  status text not null default 'active' check (status in ('active', 'archived')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (compare_at_price_amount_minor is null or price_amount_minor is null or compare_at_price_amount_minor >= price_amount_minor)
);

create table if not exists public.business_product_variant_values (
  variant_id uuid not null references public.business_product_variants(id) on delete restrict,
  option_value_id uuid not null references public.business_product_option_values(id) on delete restrict,
  product_id uuid not null references public.business_products(id) on delete restrict,
  primary key (variant_id, option_value_id)
);

create table if not exists public.business_product_countries (
  product_id uuid not null references public.business_products(id) on delete restrict,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  availability text not null check (availability in (
    'available', 'preorder', 'pre_order', 'limited', 'out_of_stock', 'discontinued', 'coming_soon', 'unavailable'
  )),
  purchase_url_override text,
  price_amount_minor_override bigint check (price_amount_minor_override is null or price_amount_minor_override >= 0),
  currency_override text check (currency_override is null or currency_override ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, country_code)
);

create table if not exists public.business_product_collection_localizations (
  collection_id uuid not null references public.business_product_collections(id) on delete restrict,
  locale text not null check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection_id, locale)
);

create table if not exists public.business_post_promotion_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  advertiser_account_id uuid not null references public.advertiser_accounts(id) on delete restrict,
  source_post_id uuid not null references public.business_posts(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'draft' check (status in (
    'draft', 'snapshot_created', 'campaign_draft_created', 'submitted_for_review',
    'approved', 'rejected', 'cancelled', 'completed'
  )),
  campaign_id uuid references public.ad_campaigns(id) on delete restrict,
  creative_snapshot_id uuid,
  public_reason text,
  internal_notes text,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.ad_creative_snapshots (
  id uuid primary key default gen_random_uuid(),
  advertiser_account_id uuid not null references public.advertiser_accounts(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  source_post_id uuid not null references public.business_posts(id) on delete restrict,
  source_post_version integer not null default 1 check (source_post_version > 0),
  snapshot_payload jsonb not null check (jsonb_typeof(snapshot_payload) = 'object'),
  snapshot_hash text not null check (snapshot_hash ~ '^[a-f0-9]{64}$'),
  destination_url text,
  destination_domain text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.ad_campaign_source_links (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  source_post_id uuid not null references public.business_posts(id) on delete restrict,
  creative_snapshot_id uuid not null references public.ad_creative_snapshots(id) on delete restrict,
  promotion_request_id uuid not null references public.business_post_promotion_requests(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (campaign_id),
  unique (promotion_request_id)
);

alter table public.business_post_promotion_requests
  drop constraint if exists business_post_promotion_requests_creative_snapshot_id_fkey;
alter table public.business_post_promotion_requests
  add constraint business_post_promotion_requests_creative_snapshot_id_fkey
  foreign key (creative_snapshot_id) references public.ad_creative_snapshots(id) on delete restrict;

alter table public.ad_campaigns
  drop constraint if exists ad_campaigns_creative_snapshot_id_fkey;
alter table public.ad_campaigns
  add constraint ad_campaigns_creative_snapshot_id_fkey
  foreign key (creative_snapshot_id) references public.ad_creative_snapshots(id) on delete restrict;

alter table public.business_post_products
  drop constraint if exists business_post_products_display_variant_id_fkey;
alter table public.business_post_products
  add constraint business_post_products_display_variant_id_fkey
  foreign key (display_variant_id) references public.business_product_variants(id) on delete set null;

create table if not exists public.business_content_moderation_history (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('product', 'post', 'media', 'promotion_request', 'external_url')),
  subject_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  from_status text,
  to_status text not null,
  reason_code text not null check (char_length(btrim(reason_code)) between 2 and 80),
  public_reason text,
  internal_notes text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.business_content_reports (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('business_profile', 'product', 'post')),
  subject_id uuid not null,
  organization_id uuid references public.organizations(id) on delete restrict,
  reporter_user_id uuid not null references public.profiles(id) on delete restrict,
  reason_code text not null check (char_length(btrim(reason_code)) between 2 and 80),
  details text,
  status text not null default 'open' check (status in ('open', 'triaged', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists business_content_reports_dedupe_uidx
  on public.business_content_reports (reporter_user_id, subject_type, subject_id, reason_code)
  where status = 'open';

create table if not exists public.business_content_events (
  event_id uuid primary key default gen_random_uuid(),
  event_type text not null check (char_length(btrim(event_type)) between 2 and 120),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  product_id uuid references public.business_products(id) on delete restrict,
  post_id uuid references public.business_posts(id) on delete restrict,
  collection_id uuid references public.business_product_collections(id) on delete restrict,
  campaign_id uuid references public.ad_campaigns(id) on delete restrict,
  viewer_user_id uuid references public.profiles(id) on delete set null,
  anonymous_session_hash text check (anonymous_session_hash is null or anonymous_session_hash ~ '^[a-f0-9]{64}$'),
  source text,
  placement text,
  locale text,
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 8 and 200),
  metadata_safe jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_safe) = 'object'),
  unique (idempotency_key)
);

create table if not exists public.business_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  metric_day date not null,
  metric_key text not null check (char_length(btrim(metric_key)) between 2 and 120),
  product_id uuid references public.business_products(id) on delete restrict,
  post_id uuid references public.business_posts(id) on delete restrict,
  metric_value bigint not null default 0 check (metric_value >= 0),
  updated_at timestamptz not null default now()
);

create unique index if not exists business_daily_metrics_uidx
  on public.business_daily_metrics (
    organization_id, metric_day, metric_key,
    coalesce(product_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(post_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- Expand legal document_key allowlist before seeding catalog policies
alter table public.business_legal_document_versions drop constraint if exists business_legal_document_versions_document_key_check;
alter table public.business_legal_document_versions
  add constraint business_legal_document_versions_document_key_check
  check (document_key in (
    'business_terms', 'privacy_notice', 'data_processing_agreement', 'advertising_policy',
    'business_verification_policy', 'commercial_content_policy', 'product_listing_policy',
    'prohibited_products_policy', 'sponsored_content_policy', 'external_sales_notice',
    'trademark_brand_ownership'
  ));

insert into public.business_legal_document_versions (document_key, version, status)
values
  ('commercial_content_policy', 'v1-draft', 'pending_legal'),
  ('product_listing_policy', 'v1-draft', 'pending_legal'),
  ('prohibited_products_policy', 'v1-draft', 'pending_legal'),
  ('sponsored_content_policy', 'v1-draft', 'pending_legal'),
  ('external_sales_notice', 'v1-draft', 'pending_legal'),
  ('trademark_brand_ownership', 'v1-draft', 'pending_legal')
on conflict (document_key, version) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers and security-definer RPCs
-- ---------------------------------------------------------------------------
create or replace function public.business_prevent_creative_snapshot_mutation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  raise exception 'AD_CREATIVE_SNAPSHOT_APPEND_ONLY' using errcode = '55000';
end;
$$;

create or replace function public.business_prevent_moderation_history_mutation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  raise exception 'BUSINESS_MODERATION_HISTORY_APPEND_ONLY' using errcode = '55000';
end;
$$;

create or replace function public.business_validate_https_url(target_url text)
returns text language plpgsql immutable security definer set search_path = public, pg_temp as $$
declare normalized text := btrim(coalesce(target_url, ''));
begin
  if normalized = '' then return null; end if;
  if normalized !~* '^https://' then raise exception 'BUSINESS_URL_HTTPS_REQUIRED' using errcode = '22023'; end if;
  if normalized ~* '^(javascript|data|file|blob):' then raise exception 'BUSINESS_URL_SCHEME_FORBIDDEN' using errcode = '22023'; end if;
  if normalized ~* '^https://[^/]*@' then raise exception 'BUSINESS_URL_CREDENTIALS_FORBIDDEN' using errcode = '22023'; end if;
  if normalized ~* 'https://(localhost|127\.0\.0\.1|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|169\.254\.|metadata)' then
    raise exception 'BUSINESS_URL_PRIVATE_FORBIDDEN' using errcode = '22023';
  end if;
  return normalized;
end;
$$;

create or replace function public.business_url_domain(target_url text)
returns text language sql immutable security definer set search_path = public, pg_temp as $$
  select lower(substring(coalesce(target_url, '') from 'https?://([^/?:#]+)'));
$$;

create or replace function public.business_has_active_catalog_legal()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select (
    select count(*) from public.business_legal_document_versions
    where status = 'active' and document_key in (
      'product_listing_policy', 'prohibited_products_policy', 'commercial_content_policy', 'external_sales_notice'
    ) and (effective_at is null or effective_at <= now())
  ) >= 4;
$$;

create or replace function public.business_has_active_sponsored_legal()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.business_legal_document_versions
    where status = 'active' and document_key in ('sponsored_content_policy', 'advertising_policy')
      and (effective_at is null or effective_at <= now())
  );
$$;

create or replace function public.business_organization_is_verified_active(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.organizations o
    where o.id = target_organization_id and o.status = 'active'
  ) and public.organization_has_active_business_badge(target_organization_id);
$$;

create or replace function public.business_product_has_pending_malware(target_product_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.business_product_media
    where product_id = target_product_id and archived_at is null
      and malware_scan_status in ('pending', 'scanning', 'infected', 'failed')
  );
$$;

create or replace function public.submit_business_product_for_review(target_product_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare product public.business_products%rowtype;
begin
  select * into product from public.business_products where id = target_product_id for update;
  if product.id is null then raise exception 'BUSINESS_PRODUCT_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.has_organization_role(product.organization_id, array['organization_owner', 'business_admin', 'brand_manager', 'content_manager']) then
    raise exception 'BUSINESS_PRODUCT_FORBIDDEN' using errcode = '42501';
  end if;
  if not public.business_organization_is_verified_active(product.organization_id) then
    raise exception 'BUSINESS_VERIFICATION_REQUIRED' using errcode = '42501';
  end if;
  if public.business_product_has_pending_malware(product.id) then
    raise exception 'BUSINESS_PRODUCT_MALWARE_REVIEW_REQUIRED' using errcode = '42501';
  end if;
  update public.business_products
  set status = 'in_review', moderation_status = 'pending', submitted_for_review_at = now(), updated_by = auth.uid(), updated_at = now()
  where id = product.id;
  insert into public.business_content_moderation_history (subject_type, subject_id, organization_id, from_status, to_status, reason_code, actor_id)
  values ('product', product.id, product.organization_id, product.status, 'in_review', 'submitted_for_review', auth.uid());
end;
$$;

create or replace function public.publish_business_product(target_product_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare product public.business_products%rowtype;
begin
  select * into product from public.business_products where id = target_product_id for update;
  if product.id is null then raise exception 'BUSINESS_PRODUCT_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.has_organization_role(product.organization_id, array['organization_owner', 'business_admin', 'brand_manager']) then
    raise exception 'BUSINESS_PRODUCT_FORBIDDEN' using errcode = '42501';
  end if;
  if not public.business_organization_is_verified_active(product.organization_id) then
    raise exception 'BUSINESS_VERIFICATION_REQUIRED' using errcode = '42501';
  end if;
  if not public.business_has_active_catalog_legal() then
    raise exception 'LEGAL_COPY_REQUIRED' using errcode = 'P0001';
  end if;
  if product.moderation_status <> 'approved' then
    raise exception 'BUSINESS_PRODUCT_MODERATION_REQUIRED' using errcode = '42501';
  end if;
  if public.business_product_has_pending_malware(product.id) then
    raise exception 'BUSINESS_PRODUCT_MALWARE_REVIEW_REQUIRED' using errcode = '42501';
  end if;
  if product.purchase_url is not null then
    perform public.business_validate_https_url(product.purchase_url);
  end if;
  if product.product_url is not null then
    perform public.business_validate_https_url(product.product_url);
  end if;
  update public.business_products
  set status = 'published', published_at = coalesce(published_at, now()), unpublished_at = null, updated_by = auth.uid(), updated_at = now()
  where id = product.id;
end;
$$;

create or replace function public.unpublish_business_product(target_product_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare product public.business_products%rowtype;
begin
  select * into product from public.business_products where id = target_product_id for update;
  if product.id is null or not public.has_organization_role(product.organization_id, array['organization_owner', 'business_admin', 'brand_manager']) then
    raise exception 'BUSINESS_PRODUCT_FORBIDDEN' using errcode = '42501';
  end if;
  update public.business_products
  set status = 'unlisted', unpublished_at = now(), updated_by = auth.uid(), updated_at = now()
  where id = product.id;
end;
$$;

create or replace function public.archive_business_product(target_product_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare product public.business_products%rowtype;
begin
  select * into product from public.business_products where id = target_product_id for update;
  if product.id is null or not public.has_organization_role(product.organization_id, array['organization_owner', 'business_admin']) then
    raise exception 'BUSINESS_PRODUCT_FORBIDDEN' using errcode = '42501';
  end if;
  update public.business_products
  set status = 'archived', archived_at = now(), updated_by = auth.uid(), updated_at = now()
  where id = product.id;
end;
$$;

create or replace function public.root_review_business_product(
  target_product_id uuid, target_status text, target_reason_code text, target_public_reason text default null, target_internal_notes text default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare product public.business_products%rowtype;
begin
  if not coalesce(public.is_root_owner(), false) then raise exception 'ROOT_OWNER_REQUIRED' using errcode = '42501'; end if;
  if target_status not in ('approved', 'requires_changes', 'rejected', 'suspended') then
    raise exception 'BUSINESS_PRODUCT_REVIEW_STATUS_INVALID' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(target_reason_code, '')), '') is null then
    raise exception 'REASON_CODE_REQUIRED' using errcode = '22023';
  end if;
  if target_status in ('rejected', 'suspended') and nullif(btrim(coalesce(target_internal_notes, '')), '') is null then
    raise exception 'INTERNAL_NOTES_REQUIRED' using errcode = '22023';
  end if;
  select * into product from public.business_products where id = target_product_id for update;
  if product.id is null then raise exception 'BUSINESS_PRODUCT_NOT_FOUND' using errcode = 'P0002'; end if;
  update public.business_products set
    moderation_status = target_status,
    status = case when target_status = 'suspended' then 'suspended' when target_status = 'rejected' then 'rejected' else status end,
    moderation_reason_public = nullif(btrim(coalesce(target_public_reason, '')), ''),
    updated_at = now()
  where id = product.id;
  insert into public.business_content_moderation_history (
    subject_type, subject_id, organization_id, from_status, to_status, reason_code, public_reason, internal_notes, actor_id
  ) values (
    'product', product.id, product.organization_id, product.moderation_status, target_status, btrim(target_reason_code),
    nullif(btrim(coalesce(target_public_reason, '')), ''), nullif(btrim(coalesce(target_internal_notes, '')), ''), auth.uid()
  );
end;
$$;

create or replace function public.publish_business_post(target_post_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare post public.business_posts%rowtype;
begin
  select * into post from public.business_posts where id = target_post_id for update;
  if post.id is null or not public.can_manage_organization_content(post.organization_id) then
    raise exception 'BUSINESS_POST_FORBIDDEN' using errcode = '42501';
  end if;
  if not public.business_organization_is_verified_active(post.organization_id) then
    raise exception 'BUSINESS_VERIFICATION_REQUIRED' using errcode = '42501';
  end if;
  if post.scheduled_for is not null and post.scheduled_for > now() then
    if coalesce(current_setting('app.business_post_scheduler_enabled', true), 'false') <> 'true' then
      raise exception 'BUSINESS_POST_SCHEDULER_BLOCKED' using errcode = 'P0001';
    end if;
    update public.business_posts set publishing_status = 'scheduled', status = 'draft', updated_at = now() where id = post.id;
    return;
  end if;
  update public.business_posts
  set publishing_status = 'published', status = 'published', moderation_status = case when moderation_status = 'pending' then 'approved' else moderation_status end,
      published_at = coalesce(published_at, now()), commercial_disclosure_state = 'organic', sponsorship_state = 'organic', updated_at = now()
  where id = post.id;
end;
$$;

create or replace function public.tag_business_post_product(target_post_id uuid, target_product_id uuid, target_position integer)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare target_organization_id uuid; product_org uuid; product_status text; product_moderation text; tag_count integer;
begin
  select organization_id into target_organization_id from public.business_posts where id = target_post_id;
  if target_organization_id is null or not public.can_manage_organization_content(target_organization_id) then
    raise exception 'BUSINESS_POST_FORBIDDEN' using errcode = '42501';
  end if;
  select organization_id, status, moderation_status into product_org, product_status, product_moderation
  from public.business_products where id = target_product_id;
  if product_org is null or product_org <> target_organization_id then
    raise exception 'BUSINESS_PRODUCT_TAG_CROSS_ORG' using errcode = '42501';
  end if;
  if product_status not in ('published', 'unlisted') or product_moderation <> 'approved' then
    raise exception 'BUSINESS_PRODUCT_TAG_NOT_ELIGIBLE' using errcode = '22023';
  end if;
  if target_position < 0 or target_position > 9 then
    raise exception 'BUSINESS_PRODUCT_TAG_LIMIT' using errcode = '22023';
  end if;
  select count(*) into tag_count from public.business_post_products where post_id = target_post_id;
  if tag_count >= 10 then raise exception 'BUSINESS_PRODUCT_TAG_LIMIT' using errcode = '22023'; end if;
  insert into public.business_post_products (post_id, product_id, position)
  values (target_post_id, target_product_id, target_position)
  on conflict (post_id, product_id) do update set position = excluded.position;
end;
$$;

create or replace function public.create_business_post_promotion_request(target_post_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare post public.business_posts%rowtype; advertiser_id uuid; request_id uuid;
begin
  select * into post from public.business_posts where id = target_post_id for update;
  if post.id is null then raise exception 'BUSINESS_POST_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.has_organization_role(post.organization_id, array['organization_owner', 'business_admin', 'campaign_manager']) then
    raise exception 'BUSINESS_PROMOTION_FORBIDDEN' using errcode = '42501';
  end if;
  if post.status <> 'published' or post.sponsorship_state <> 'organic' then
    raise exception 'BUSINESS_PROMOTION_SOURCE_INVALID' using errcode = '22023';
  end if;
  if not public.business_has_active_sponsored_legal() then
    raise exception 'LEGAL_COPY_REQUIRED' using errcode = 'P0001';
  end if;
  select id into advertiser_id from public.advertiser_accounts
  where owner_type = 'organization' and owner_id = post.organization_id and advertising_status <> 'suspended'
  order by created_at desc limit 1;
  if advertiser_id is null then raise exception 'ADVERTISER_ACCOUNT_REQUIRED' using errcode = 'P0002'; end if;
  insert into public.business_post_promotion_requests (organization_id, advertiser_account_id, source_post_id, requested_by, status)
  values (post.organization_id, advertiser_id, post.id, auth.uid(), 'draft')
  returning id into request_id;
  update public.business_posts set commercial_disclosure_state = 'promotion_requested', updated_at = now() where id = post.id;
  -- Source post remains organic: do not change sponsorship_state.
  return request_id;
end;
$$;

create or replace function public.create_business_promotion_creative_snapshot(target_promotion_request_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare req public.business_post_promotion_requests%rowtype; post public.business_posts%rowtype;
  payload jsonb; digest text; snapshot_id uuid; destination text; destination_host text;
begin
  select * into req from public.business_post_promotion_requests where id = target_promotion_request_id for update;
  if req.id is null then raise exception 'BUSINESS_PROMOTION_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.has_organization_role(req.organization_id, array['organization_owner', 'business_admin', 'campaign_manager']) then
    raise exception 'BUSINESS_PROMOTION_FORBIDDEN' using errcode = '42501';
  end if;
  select * into post from public.business_posts where id = req.source_post_id;
  if post.id is null or post.status <> 'published' then raise exception 'BUSINESS_PROMOTION_SOURCE_INVALID' using errcode = '22023'; end if;
  select coalesce(
    (select p.purchase_url from public.business_post_products bpp join public.business_products p on p.id = bpp.product_id
     where bpp.post_id = post.id and p.status = 'published' and p.moderation_status = 'approved' order by bpp.position limit 1),
    null
  ) into destination;
  if destination is not null then destination := public.business_validate_https_url(destination); end if;
  destination_host := public.business_url_domain(destination);
  payload := jsonb_build_object(
    'sourcePostId', post.id,
    'organizationId', post.organization_id,
    'postType', post.post_type,
    'body', post.body,
    'publishedAt', post.published_at,
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'slug', p.slug, 'priceDisplayMode', p.price_display_mode,
        'priceAmountMinor', p.price_amount_minor, 'currency', p.currency, 'availability', p.availability,
        'purchaseUrl', p.purchase_url, 'destinationDomain', public.business_url_domain(p.purchase_url)
      ) order by bpp.position)
      from public.business_post_products bpp
      join public.business_products p on p.id = bpp.product_id
      where bpp.post_id = post.id and p.status = 'published' and p.moderation_status = 'approved' and p.archived_at is null
    ), '[]'::jsonb),
    'disclosure', 'sponsored'
  );
  digest := encode(extensions.digest(payload::text, 'sha256'), 'hex');
  insert into public.ad_creative_snapshots (
    advertiser_account_id, organization_id, source_post_id, source_post_version, snapshot_payload, snapshot_hash,
    destination_url, destination_domain, created_by
  ) values (
    req.advertiser_account_id, req.organization_id, post.id, 1, payload, digest, destination, destination_host, auth.uid()
  ) returning id into snapshot_id;
  update public.business_post_promotion_requests
  set creative_snapshot_id = snapshot_id, status = 'snapshot_created', updated_at = now()
  where id = req.id;
  update public.business_posts
  set commercial_disclosure_state = 'promotion_snapshot_created', updated_at = now()
  where id = post.id;
  return snapshot_id;
end;
$$;

create or replace function public.create_business_campaign_draft_from_promotion(target_promotion_request_id uuid, target_campaign_name text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare req public.business_post_promotion_requests%rowtype; campaign_id uuid; snapshot public.ad_creative_snapshots%rowtype;
begin
  select * into req from public.business_post_promotion_requests where id = target_promotion_request_id for update;
  if req.id is null or req.creative_snapshot_id is null then raise exception 'BUSINESS_PROMOTION_SNAPSHOT_REQUIRED' using errcode = '22023'; end if;
  if not public.has_organization_role(req.organization_id, array['organization_owner', 'business_admin', 'campaign_manager']) then
    raise exception 'BUSINESS_PROMOTION_FORBIDDEN' using errcode = '42501';
  end if;
  if not public.business_has_active_sponsored_legal() then raise exception 'LEGAL_COPY_REQUIRED' using errcode = 'P0001'; end if;
  select * into snapshot from public.ad_creative_snapshots where id = req.creative_snapshot_id;
  insert into public.ad_campaigns (
    name, advertiser_label, objective, status, review_status, budget_cents, advertiser_account_id, organization_id,
    creative_snapshot_id, source_post_id, created_by
  ) values (
    left(btrim(coalesce(nullif(target_campaign_name, ''), 'Business promotion draft')), 120),
    'Business organization', 'traffic', 'draft', 'pending', 0, req.advertiser_account_id, req.organization_id,
    snapshot.id, req.source_post_id, auth.uid()
  ) returning id into campaign_id;
  insert into public.ad_campaign_source_links (campaign_id, organization_id, source_post_id, creative_snapshot_id, promotion_request_id)
  values (campaign_id, req.organization_id, req.source_post_id, snapshot.id, req.id);
  update public.business_post_promotion_requests
  set campaign_id = campaign_id, status = 'campaign_draft_created', updated_at = now()
  where id = req.id;
  -- Campaign stays draft; client cannot activate. Source post remains organic.
  return campaign_id;
end;
$$;

create or replace function public.get_public_business_product(target_business_slug text, target_product_slug text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', p.id,
    'organizationId', p.organization_id,
    'businessSlug', bp.slug,
    'businessDisplayName', bp.display_name,
    'verifiedBusiness', public.organization_has_active_business_badge(p.organization_id),
    'name', p.name,
    'slug', p.slug,
    'shortDescription', p.short_description,
    'description', p.description,
    'productType', p.product_type,
    'priceDisplayMode', p.price_display_mode,
    'priceAmountMinor', case when p.price_display_mode in ('contact_for_price', 'not_displayed') then null else p.price_amount_minor end,
    'compareAtPriceAmountMinor', case when p.price_display_mode in ('contact_for_price', 'not_displayed') then null else p.compare_at_price_amount_minor end,
    'currency', p.currency,
    'availability', p.availability,
    'availabilityText', p.availability_text,
    'purchaseUrl', p.purchase_url,
    'productUrl', p.product_url,
    'supportUrl', p.support_url,
    'destinationDomain', public.business_url_domain(coalesce(p.purchase_url, p.product_url)),
    'publishedAt', p.published_at,
    'variants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'title', v.title, 'availability', v.availability,
        'priceAmountMinor', v.price_amount_minor, 'currency', coalesce(v.currency, p.currency),
        'externalPurchaseUrl', v.external_purchase_url
      ) order by v.sort_order)
      from public.business_product_variants v
      where v.product_id = p.id and v.status = 'active'
    ), '[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'mediaType', m.media_type, 'altText', m.alt_text, 'position', m.position, 'isPrimary', m.is_primary
      ) order by m.position)
      from public.business_product_media m
      where m.product_id = p.id and m.archived_at is null and m.moderation_status = 'approved'
        and m.malware_scan_status = 'clean' and m.processing_status in ('ready', 'pending')
        and m.upload_status = 'uploaded'
    ), '[]'::jsonb)
  )
  from public.business_products p
  join public.business_profiles bp on bp.organization_id = p.organization_id
  join public.organizations o on o.id = p.organization_id
  where bp.slug = lower(btrim(target_business_slug))
    and p.slug = lower(btrim(target_product_slug))
    and p.status = 'published'
    and p.moderation_status = 'approved'
    and o.status = 'active'
    and public.organization_has_active_business_badge(p.organization_id)
    and bp.public_status = 'published';
$$;

create or replace function public.ingest_business_content_event(
  target_event_type text, target_organization_id uuid, target_idempotency_key text,
  target_product_id uuid default null, target_post_id uuid default null, target_collection_id uuid default null,
  target_campaign_id uuid default null, target_source text default null, target_placement text default null,
  target_locale text default null, target_country_code text default null, target_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare event_uuid uuid; existing uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select event_id into existing from public.business_content_events where idempotency_key = btrim(target_idempotency_key);
  if existing is not null then return existing; end if;
  if target_campaign_id is not null then
    -- Paid campaign delivery metrics require a future delivery engine; reject client-side paid conversion fabrication.
    if target_event_type in ('sale', 'order', 'revenue', 'roas', 'purchase_conversion') then
      raise exception 'BUSINESS_ANALYTICS_METRIC_FORBIDDEN' using errcode = '22023';
    end if;
  end if;
  insert into public.business_content_events (
    event_type, organization_id, product_id, post_id, collection_id, campaign_id, viewer_user_id,
    source, placement, locale, country_code, idempotency_key, metadata_safe
  ) values (
    btrim(target_event_type), target_organization_id, target_product_id, target_post_id, target_collection_id, target_campaign_id, auth.uid(),
    nullif(btrim(coalesce(target_source, '')), ''), nullif(btrim(coalesce(target_placement, '')), ''),
    nullif(btrim(coalesce(target_locale, '')), ''), nullif(upper(btrim(coalesce(target_country_code, ''))), ''),
    btrim(target_idempotency_key), coalesce(target_metadata, '{}'::jsonb) - array['ip', 'accessToken', 'refreshToken', 'rawUrl']
  ) returning event_id into event_uuid;
  insert into public.business_daily_metrics (organization_id, metric_day, metric_key, product_id, post_id, metric_value)
  values (target_organization_id, (timezone('utc', now()))::date, btrim(target_event_type), target_product_id, target_post_id, 1)
  on conflict do nothing;
  -- Upsert aggregate via update when unique conflict on expression index is hard; use dedicated merge:
  update public.business_daily_metrics
  set metric_value = metric_value + 1, updated_at = now()
  where organization_id = target_organization_id
    and metric_day = (timezone('utc', now()))::date
    and metric_key = btrim(target_event_type)
    and product_id is not distinct from target_product_id
    and post_id is not distinct from target_post_id
    and metric_value >= 1;
  if not found then
    insert into public.business_daily_metrics (organization_id, metric_day, metric_key, product_id, post_id, metric_value)
    values (target_organization_id, (timezone('utc', now()))::date, btrim(target_event_type), target_product_id, target_post_id, 1)
    on conflict do nothing;
  end if;
  return event_uuid;
end;
$$;

create or replace function public.report_business_content(
  target_subject_type text, target_subject_id uuid, target_reason_code text, target_details text default null, target_organization_id uuid default null
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare report_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if target_subject_type not in ('business_profile', 'product', 'post') then
    raise exception 'BUSINESS_REPORT_SUBJECT_INVALID' using errcode = '22023';
  end if;
  insert into public.business_content_reports (subject_type, subject_id, organization_id, reporter_user_id, reason_code, details)
  values (target_subject_type, target_subject_id, target_organization_id, auth.uid(), btrim(target_reason_code), nullif(btrim(coalesce(target_details, '')), ''))
  on conflict (reporter_user_id, subject_type, subject_id, reason_code) where status = 'open'
  do update set details = excluded.details
  returning id into report_id;
  return report_id;
end;
$$;

create or replace function public.get_business_analytics_overview(target_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare min_cohort integer := greatest(coalesce(nullif(current_setting('app.business_analytics_minimum_cohort', true), '')::integer, 5), 5);
begin
  if not public.has_organization_role(target_organization_id, array['organization_owner', 'business_admin', 'analyst', 'campaign_manager']) then
    raise exception 'BUSINESS_ANALYTICS_FORBIDDEN' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'metricKey', m.metric_key,
      'metricDay', m.metric_day,
      'productId', m.product_id,
      'postId', m.post_id,
      'value', case when m.metric_value < min_cohort then null else m.metric_value end,
      'suppressed', m.metric_value < min_cohort
    ) order by m.metric_day desc)
    from public.business_daily_metrics m
    where m.organization_id = target_organization_id
      and m.metric_key not in ('sale', 'order', 'revenue', 'roas', 'purchase_conversion')
  ), '[]'::jsonb);
end;
$$;

create or replace function public.resolve_sponsored_delivery_eligibility(target_user_id uuid, target_campaign_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare campaign public.ad_campaigns%rowtype; base jsonb;
begin
  select * into campaign from public.ad_campaigns where id = target_campaign_id;
  if campaign.id is null then
    return jsonb_build_object('eligible', false, 'reason', 'campaign_not_found');
  end if;
  if campaign.status <> 'active' or campaign.review_status <> 'approved' then
    return jsonb_build_object('eligible', false, 'reason', 'campaign_not_active');
  end if;
  base := public.resolve_ad_eligibility(target_user_id, 'business_sponsored', jsonb_build_object('contentKind', 'sponsored_business'));
  return base || jsonb_build_object('campaignId', campaign.id, 'disclosureRequired', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers, storage, RLS, grants
-- ---------------------------------------------------------------------------
drop trigger if exists ad_creative_snapshots_append_only on public.ad_creative_snapshots;
create trigger ad_creative_snapshots_append_only
  before update or delete on public.ad_creative_snapshots
  for each row execute function public.business_prevent_creative_snapshot_mutation();

drop trigger if exists business_content_moderation_history_append_only on public.business_content_moderation_history;
create trigger business_content_moderation_history_append_only
  before update or delete on public.business_content_moderation_history
  for each row execute function public.business_prevent_moderation_history_mutation();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('business-product-media', 'business-product-media', false, 52428800, array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists business_product_media_objects_select on storage.objects;
drop policy if exists business_product_media_objects_insert on storage.objects;
create policy business_product_media_objects_select on storage.objects for select to authenticated using (
  bucket_id = 'business-product-media' and exists (
    select 1 from public.business_product_media m
    where m.storage_path = name
      and (public.has_organization_role(m.organization_id, array['organization_owner', 'business_admin', 'brand_manager', 'content_manager'])
        or public.is_root_owner())
  )
);
create policy business_product_media_objects_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'business-product-media'
  and name ~ '^organizations/[0-9a-f-]{36}/products/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|mp4|webm)$'
  and public.has_organization_role((storage.foldername(name))[2]::uuid, array['organization_owner', 'business_admin', 'brand_manager', 'content_manager'])
);

alter table public.business_product_localizations enable row level security;
alter table public.business_product_options enable row level security;
alter table public.business_product_option_values enable row level security;
alter table public.business_product_variants enable row level security;
alter table public.business_product_variant_values enable row level security;
alter table public.business_product_countries enable row level security;
alter table public.business_product_collection_localizations enable row level security;
alter table public.business_post_promotion_requests enable row level security;
alter table public.ad_creative_snapshots enable row level security;
alter table public.ad_campaign_source_links enable row level security;
alter table public.business_content_moderation_history enable row level security;
alter table public.business_content_reports enable row level security;
alter table public.business_content_events enable row level security;
alter table public.business_daily_metrics enable row level security;

create policy business_catalog_member_select_localizations on public.business_product_localizations for select to authenticated
  using (exists (select 1 from public.business_products p where p.id = product_id and (
    public.has_organization_role(p.organization_id, array['organization_owner', 'business_admin', 'brand_manager', 'content_manager', 'analyst'])
    or public.is_root_owner()
  )));
create policy business_catalog_member_select_options on public.business_product_options for select to authenticated
  using (public.has_organization_role(organization_id, array['organization_owner', 'business_admin', 'brand_manager', 'content_manager', 'analyst']) or public.is_root_owner());
create policy business_catalog_member_select_variants on public.business_product_variants for select to authenticated
  using (public.has_organization_role(organization_id, array['organization_owner', 'business_admin', 'brand_manager', 'content_manager', 'analyst']) or public.is_root_owner());
create policy business_catalog_member_select_countries on public.business_product_countries for select to authenticated
  using (exists (select 1 from public.business_products p where p.id = product_id and (
    public.has_organization_role(p.organization_id, array['organization_owner', 'business_admin', 'brand_manager', 'content_manager', 'analyst'])
    or public.is_root_owner()
  )));
create policy business_promotion_member_select on public.business_post_promotion_requests for select to authenticated
  using (public.has_organization_role(organization_id, array['organization_owner', 'business_admin', 'campaign_manager']) or public.is_root_owner());
create policy business_snapshot_member_select on public.ad_creative_snapshots for select to authenticated
  using (public.has_organization_role(organization_id, array['organization_owner', 'business_admin', 'campaign_manager']) or public.is_root_owner());
create policy business_campaign_source_member_select on public.ad_campaign_source_links for select to authenticated
  using (public.has_organization_role(organization_id, array['organization_owner', 'business_admin', 'campaign_manager']) or public.is_root_owner());
create policy business_moderation_history_root_select on public.business_content_moderation_history for select to authenticated
  using (public.is_root_owner());
create policy business_content_reports_root_select on public.business_content_reports for select to authenticated
  using (public.is_root_owner() or reporter_user_id = auth.uid());
create policy business_content_events_service_select on public.business_content_events for select to authenticated
  using (public.is_root_owner());
create policy business_daily_metrics_member_select on public.business_daily_metrics for select to authenticated
  using (public.has_organization_role(organization_id, array['organization_owner', 'business_admin', 'analyst', 'campaign_manager']) or public.is_root_owner());

revoke all on public.business_product_localizations, public.business_product_options, public.business_product_option_values,
  public.business_product_variants, public.business_product_variant_values, public.business_product_countries,
  public.business_product_collection_localizations, public.business_post_promotion_requests, public.ad_creative_snapshots,
  public.ad_campaign_source_links, public.business_content_moderation_history, public.business_content_reports,
  public.business_content_events, public.business_daily_metrics from public, anon, authenticated;

grant select on public.business_product_localizations, public.business_product_options, public.business_product_option_values,
  public.business_product_variants, public.business_product_variant_values, public.business_product_countries,
  public.business_product_collection_localizations, public.business_post_promotion_requests, public.ad_creative_snapshots,
  public.ad_campaign_source_links, public.business_content_moderation_history, public.business_content_reports,
  public.business_daily_metrics to authenticated;

revoke all on function public.business_prevent_creative_snapshot_mutation(), public.business_prevent_moderation_history_mutation(),
  public.business_validate_https_url(text), public.business_url_domain(text), public.business_has_active_catalog_legal(),
  public.business_has_active_sponsored_legal(), public.business_organization_is_verified_active(uuid),
  public.business_product_has_pending_malware(uuid), public.submit_business_product_for_review(uuid),
  public.publish_business_product(uuid), public.unpublish_business_product(uuid), public.archive_business_product(uuid),
  public.root_review_business_product(uuid, text, text, text, text), public.publish_business_post(uuid),
  public.tag_business_post_product(uuid, uuid, integer), public.create_business_post_promotion_request(uuid),
  public.create_business_promotion_creative_snapshot(uuid), public.create_business_campaign_draft_from_promotion(uuid, text),
  public.get_public_business_product(text, text), public.ingest_business_content_event(text, uuid, text, uuid, uuid, uuid, uuid, text, text, text, text, jsonb),
  public.report_business_content(text, uuid, text, text, uuid), public.get_business_analytics_overview(uuid),
  public.resolve_sponsored_delivery_eligibility(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.business_validate_https_url(text), public.business_url_domain(text),
  public.submit_business_product_for_review(uuid), public.publish_business_product(uuid), public.unpublish_business_product(uuid),
  public.archive_business_product(uuid), public.root_review_business_product(uuid, text, text, text, text),
  public.publish_business_post(uuid), public.tag_business_post_product(uuid, uuid, integer),
  public.create_business_post_promotion_request(uuid), public.create_business_promotion_creative_snapshot(uuid),
  public.create_business_campaign_draft_from_promotion(uuid, text), public.get_public_business_product(text, text),
  public.ingest_business_content_event(text, uuid, text, uuid, uuid, uuid, uuid, text, text, text, text, jsonb),
  public.report_business_content(text, uuid, text, text, uuid), public.get_business_analytics_overview(uuid),
  public.resolve_sponsored_delivery_eligibility(uuid, uuid) to authenticated;

grant execute on function public.get_public_business_product(text, text) to anon;

create or replace view public.public_business_products
with (security_barrier = true)
as
select product.id, product.organization_id, product.name, product.slug, product.short_description, product.description,
  product.product_type, product.price_display_mode, product.price_amount_minor, product.compare_at_price_amount_minor,
  product.currency, product.availability, product.availability_text, product.purchase_url, product.product_url,
  product.support_url, product.published_at
from public.business_products product
join public.organizations organization on organization.id = product.organization_id
where product.status = 'published'
  and product.moderation_status = 'approved'
  and organization.status = 'active'
  and public.organization_has_active_business_badge(product.organization_id);

create or replace view public.public_business_posts
with (security_barrier = true)
as
select post.id, post.organization_id, post.post_type, post.body, post.published_at, post.created_at,
  post.commercial_disclosure_state, post.sponsorship_state
from public.business_posts post
join public.organizations organization on organization.id = post.organization_id
where post.status = 'published'
  and post.publishing_status = 'published'
  and post.sponsorship_state = 'organic'
  and post.commercial_disclosure_state in ('organic', 'promotion_requested', 'promotion_snapshot_created', 'promotion_completed')
  and organization.status = 'active';

grant select on public.public_business_products, public.public_business_posts to anon, authenticated;

commit;
