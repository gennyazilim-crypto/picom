-- PICOM Business application verification, legal acceptance, and organization management.
-- Additive migration: preserves all existing foundation tables and data.
begin;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Application and invitation extensions
-- ---------------------------------------------------------------------------
alter table public.business_applications
  add column if not exists representative_job_title text,
  add column if not exists representative_email text,
  add column if not exists representative_phone text,
  add column if not exists company_description text,
  add column if not exists partnership_purpose text,
  add column if not exists products_or_services_summary text,
  add column if not exists industry_code text,
  add column if not exists submission_version integer not null default 0 check (submission_version >= 0),
  add column if not exists risk_level text not null default 'unknown' check (risk_level in ('unknown', 'low', 'medium', 'high', 'critical')),
  add column if not exists assigned_reviewer_id uuid references public.profiles(id) on delete set null,
  add column if not exists editable_field_allowlist text[] not null default '{}'::text[],
  add column if not exists idempotency_key text;

alter table public.business_applications
  drop constraint if exists business_applications_company_type_check;

update public.business_applications
set company_type = case
  when lower(btrim(company_type)) in ('sole_trader', 'partnership', 'limited_company', 'corporation', 'nonprofit', 'public_institution', 'agency', 'other')
    then lower(btrim(company_type))
  else 'other'
end;

alter table public.business_applications
  add constraint business_applications_company_type_check
    check (company_type in ('sole_trader', 'partnership', 'limited_company', 'corporation', 'nonprofit', 'public_institution', 'agency', 'other'));

create unique index if not exists business_applications_idempotency_key_uidx
  on public.business_applications (applicant_user_id, idempotency_key)
  where idempotency_key is not null;

alter table public.organization_invitations
  add column if not exists invited_email_normalized text,
  add column if not exists invited_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists token_hash text,
  add column if not exists revoked_at timestamptz;

update public.organization_invitations
set invited_email_normalized = lower(btrim(invited_email))
where invited_email_normalized is null;

alter table public.organization_invitations
  alter column invited_email_normalized set not null,
  drop constraint if exists organization_invitations_status_check,
  add constraint organization_invitations_status_check
    check (status in ('pending', 'accepted', 'declined', 'expired', 'revoked', 'cancelled'));

create unique index if not exists organization_invitations_token_hash_uidx
  on public.organization_invitations (token_hash) where token_hash is not null;

-- ---------------------------------------------------------------------------
-- New private business-control tables
-- ---------------------------------------------------------------------------
create table if not exists public.business_application_submissions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.business_applications(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  submission_version integer not null check (submission_version > 0),
  submitted_payload jsonb not null check (jsonb_typeof(submitted_payload) = 'object'),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  unique (application_id, submission_version)
);

create table if not exists public.business_application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.business_applications(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  document_type text not null check (char_length(btrim(document_type)) between 2 and 80),
  file_name text not null check (char_length(btrim(file_name)) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  storage_path text not null unique check (char_length(btrim(storage_path)) between 3 and 1024),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  malware_scan_status text not null default 'pending' check (malware_scan_status in ('pending', 'scanning', 'clean', 'infected', 'failed')),
  review_status text not null default 'pending' check (review_status in ('pending', 'accepted', 'rejected', 'expired')),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  scanned_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  unique (application_id, sha256, document_type)
);

create table if not exists public.business_domain_verifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  domain text not null,
  verification_method text not null check (verification_method in ('dns_txt', 'email', 'manual')),
  challenge_token_hash text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed', 'expired', 'revoked')),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, domain)
);

create table if not exists public.business_profile_followers (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.organization_ownership_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  from_user_id uuid not null references public.profiles(id) on delete restrict,
  to_user_id uuid not null references public.profiles(id) on delete restrict,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

create table if not exists public.business_legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_key text not null check (document_key in ('business_terms', 'privacy_notice', 'data_processing_agreement', 'advertising_policy', 'business_verification_policy')),
  version text not null check (char_length(btrim(version)) between 1 and 80),
  content_hash text,
  status text not null default 'draft' check (status in ('draft', 'pending_legal', 'active', 'retired')),
  effective_at timestamptz,
  created_at timestamptz not null default now(),
  unique (document_key, version)
);

create table if not exists public.business_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  application_id uuid references public.business_applications(id) on delete restrict,
  legal_document_version_id uuid not null references public.business_legal_document_versions(id) on delete restrict,
  accepted_by uuid not null references public.profiles(id) on delete restrict,
  accepted_at timestamptz not null default now(),
  ip_hash text,
  unique (organization_id, legal_document_version_id)
);

create table if not exists public.business_rate_limits (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  rate_limit_key text not null check (char_length(btrim(rate_limit_key)) between 2 and 120),
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, rate_limit_key, window_started_at)
);

create table if not exists public.business_risk_flags (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.business_applications(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  flag_type text not null check (char_length(btrim(flag_type)) between 2 and 120),
  detail text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

insert into public.business_legal_document_versions (document_key, version, status)
values
  ('business_terms', 'v1-draft', 'pending_legal'),
  ('privacy_notice', 'v1-draft', 'pending_legal'),
  ('data_processing_agreement', 'v1-draft', 'pending_legal'),
  ('advertising_policy', 'v1-draft', 'pending_legal'),
  ('business_verification_policy', 'v1-draft', 'pending_legal')
on conflict (document_key, version) do nothing;

-- ---------------------------------------------------------------------------
-- Internal helpers and immutable submission history
-- ---------------------------------------------------------------------------
create or replace function public.business_prevent_submission_mutation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  raise exception 'BUSINESS_APPLICATION_SUBMISSIONS_APPEND_ONLY' using errcode = '55000';
end;
$$;

create or replace function public.business_normalize_domain(target_domain text)
returns text language plpgsql immutable security definer set search_path = public, pg_temp as $$
declare normalized text := lower(btrim(coalesce(target_domain, '')));
begin
  normalized := regexp_replace(normalized, '^https?://', '');
  normalized := split_part(normalized, '/', 1);
  normalized := split_part(normalized, ':', 1);
  if normalized = '' or normalized !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'
     or normalized like '%.local' or normalized like '%.internal' or normalized like '%.localhost'
     or normalized in ('localhost', 'test', 'invalid', 'example') then
    raise exception 'BUSINESS_DOMAIN_INVALID_OR_PRIVATE' using errcode = '22023';
  end if;
  return normalized;
end;
$$;

create or replace function public.business_is_consumer_email_domain(target_domain text)
returns boolean language sql immutable security definer set search_path = public, pg_temp as $$
  select lower(btrim(coalesce(target_domain, ''))) in (
    'gmail.com','googlemail.com','yahoo.com','outlook.com','hotmail.com','live.com',
    'icloud.com','me.com','mac.com','aol.com','proton.me','protonmail.com','gmx.com','mail.com','yandex.com'
  );
$$;

create or replace function public.business_consume_rate_limit(
  target_organization_id uuid, target_key text, target_limit integer, target_window_seconds integer
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare window_start timestamptz; next_count integer;
begin
  if auth.uid() is null or target_limit < 1 or target_window_seconds < 1 then
    raise exception 'BUSINESS_RATE_LIMIT_INPUT_INVALID' using errcode = '22023';
  end if;
  window_start := to_timestamp(floor(extract(epoch from now()) / target_window_seconds) * target_window_seconds);
  insert into public.business_rate_limits (organization_id, rate_limit_key, window_started_at, request_count)
  values (target_organization_id, btrim(target_key), window_start, 1)
  on conflict (organization_id, rate_limit_key, window_started_at) do update
    set request_count = public.business_rate_limits.request_count + 1, updated_at = now()
  returning request_count into next_count;
  return next_count <= target_limit;
end;
$$;

create or replace function public.business_application_transition_allowed(from_status text, to_status text)
returns boolean language sql immutable security definer set search_path = public, pg_temp as $$
  select (from_status, to_status) in (
    ('draft','submitted'),
    ('requires_information','submitted'),
    ('submitted','under_review'),
    ('submitted','requires_information'),
    ('submitted','identity_verification_required'),
    ('submitted','approved'),
    ('submitted','rejected'),
    ('submitted','expired'),
    ('under_review','requires_information'),
    ('under_review','identity_verification_required'),
    ('under_review','approved'),
    ('under_review','rejected'),
    ('under_review','expired'),
    ('identity_verification_required','under_review'),
    ('identity_verification_required','approved'),
    ('identity_verification_required','rejected'),
    ('requires_information','expired'),
    ('approved','suspended'),
    ('approved','revoked'),
    ('approved','expired'),
    ('suspended','approved'),
    ('suspended','revoked'),
    ('rejected','draft')
  );
$$;

create or replace function public.business_application_has_pending_malware(target_application_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.business_application_documents
    where application_id = target_application_id
      and malware_scan_status in ('pending', 'scanning', 'infected', 'failed')
  );
$$;

create or replace function public.organization_has_active_business_badge(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.verification_badges
    where subject_type = 'organization' and subject_id = target_organization_id and badge_kind = 'business'
      and status = 'active' and revoked_at is null and (expires_at is null or expires_at > now())
  );
$$;

create or replace function public.reconcile_business_organization_entitlements(target_organization_id uuid, source_event text default 'manual')
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare badge_active boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not coalesce(public.is_root_owner(), false) then
    raise exception 'SERVICE_OR_ROOT_REQUIRED' using errcode = '42501';
  end if;
  badge_active := public.organization_has_active_business_badge(target_organization_id);
  update public.account_entitlements
  set status = case when badge_active then 'expired' else 'revoked' end, ends_at = now(), updated_at = now(), version = version + 1
  where subject_type = 'organization' and subject_id = target_organization_id and entitlement_key = 'business_dashboard'
    and source_type = 'business_application' and status in ('pending', 'active', 'grace_period', 'suspended');
  if badge_active then
    insert into public.account_entitlements (subject_type, subject_id, entitlement_key, status, source_type, starts_at, metadata)
    values ('organization', target_organization_id, 'business_dashboard', 'active', 'business_application', now(),
      jsonb_build_object('sourceEvent', left(coalesce(source_event, 'manual'), 120)));
  end if;
  return jsonb_build_object('organizationId', target_organization_id, 'businessDashboardActive', badge_active);
end;
$$;

-- Root approval is intentionally declared once in this migration.
create or replace function public.approve_business_application(
  target_application_id uuid, target_public_reason text default null, target_internal_notes text default null, target_idempotency_key text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare app public.business_applications%rowtype; request_hash text; existing_response text;
begin
  if not coalesce(public.is_root_owner(), false) then raise exception 'ROOT_OWNER_REQUIRED' using errcode = '42501'; end if;
  select * into app from public.business_applications where id = target_application_id for update;
  if app.id is null then raise exception 'BUSINESS_APPLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if public.business_application_has_pending_malware(app.id) then raise exception 'BUSINESS_DOCUMENT_MALWARE_REVIEW_REQUIRED' using errcode = '42501'; end if;
  if app.status <> 'approved' and not public.business_application_transition_allowed(app.status, 'approved') then
    raise exception 'BUSINESS_APPLICATION_TRANSITION_FORBIDDEN' using errcode = '22023';
  end if;
  request_hash := encode(extensions.digest(concat_ws('|', target_application_id::text, coalesce(target_public_reason,''), coalesce(target_internal_notes,'')), 'sha256'), 'hex');
  if nullif(btrim(coalesce(target_idempotency_key, '')), '') is not null then
    select response_reference into existing_response from public.platform_idempotency_keys
    where scope = 'approve_business_application' and idempotency_key = btrim(target_idempotency_key);
    if found then
      if existing_response = target_application_id::text then return jsonb_build_object('applicationId', app.id, 'idempotent', true); end if;
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '23505';
    end if;
    insert into public.platform_idempotency_keys (scope, idempotency_key, actor_id, request_hash, response_reference)
    values ('approve_business_application', btrim(target_idempotency_key), auth.uid(), request_hash, target_application_id::text);
  end if;
  update public.business_applications set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(),
    public_decision_reason = nullif(btrim(coalesce(target_public_reason, '')), ''),
    internal_review_notes = nullif(btrim(coalesce(target_internal_notes, '')), '') where id = app.id;
  update public.organizations set status = 'active' where id = app.organization_id;
  insert into public.verification_badges (subject_type, subject_id, badge_kind, label, scope_note, granted_by, status, source_type, source_id, public_reason_code)
  values ('organization', app.organization_id, 'business', 'Business', 'Approved PICOM Business organization.', auth.uid(), 'active', 'business_application', app.id, 'business_approved')
  on conflict (subject_type, subject_id, badge_kind) where status = 'active' do update
    set revoked_at = null, suspended_at = null, public_reason_code = excluded.public_reason_code, updated_at = now();
  perform public.reconcile_business_organization_entitlements(app.organization_id, 'application_approved');
  return jsonb_build_object('applicationId', app.id, 'organizationId', app.organization_id, 'approved', true);
end;
$$;

create or replace function public.transition_business_application(
  target_application_id uuid, target_status text, target_public_reason text default null, target_internal_notes text default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare app public.business_applications%rowtype;
begin
  if not coalesce(public.is_root_owner(), false) then raise exception 'ROOT_OWNER_REQUIRED' using errcode = '42501'; end if;
  if target_status = 'approved' then raise exception 'USE_APPROVE_BUSINESS_APPLICATION' using errcode = '22023'; end if;
  select * into app from public.business_applications where id = target_application_id for update;
  if app.id is null then raise exception 'BUSINESS_APPLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.business_application_transition_allowed(app.status, target_status) then raise exception 'BUSINESS_APPLICATION_TRANSITION_FORBIDDEN' using errcode = '22023'; end if;
  if target_status in ('rejected', 'suspended', 'revoked') and nullif(btrim(coalesce(target_internal_notes, '')), '') is null then
    raise exception 'INTERNAL_NOTES_REQUIRED' using errcode = '22023';
  end if;
  update public.business_applications set status = target_status, reviewed_at = now(), reviewed_by = auth.uid(),
    public_decision_reason = nullif(btrim(coalesce(target_public_reason, '')), ''), internal_review_notes = nullif(btrim(coalesce(target_internal_notes, '')), '') where id = app.id;
  if target_status in ('suspended', 'revoked') then
    update public.verification_badges set status = target_status, suspended_at = case when target_status = 'suspended' then now() else suspended_at end,
      revoked_at = case when target_status = 'revoked' then now() else revoked_at end, updated_at = now()
    where subject_type = 'organization' and subject_id = app.organization_id and badge_kind = 'business' and status = 'active';
    update public.business_profiles set public_status = 'suspended', updated_at = now() where organization_id = app.organization_id and public_status = 'published';
    update public.organizations set status = 'suspended', updated_at = now() where id = app.organization_id;
    perform public.reconcile_business_organization_entitlements(app.organization_id, 'application_' || target_status);
  end if;
end;
$$;

create or replace function public.upsert_business_application_draft(target_payload jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare app_id uuid; org_id uuid := nullif(target_payload->>'organizationId', '')::uuid;
begin
  if auth.uid() is null or jsonb_typeof(target_payload) <> 'object' then raise exception 'BUSINESS_APPLICATION_PAYLOAD_INVALID' using errcode = '22023'; end if;
  if not public.has_organization_role(org_id, array['organization_owner', 'business_admin']) then raise exception 'BUSINESS_APPLICATION_FORBIDDEN' using errcode = '42501'; end if;
  insert into public.business_applications (
    organization_id, applicant_user_id, legal_name, brand_name, company_type, registered_country, registered_address, representative_name,
    representative_job_title, representative_email, representative_phone, company_description, advertising_purpose, partnership_purpose,
    products_or_services_summary, industry, industry_code, official_website, corporate_email_domain, idempotency_key, status
  ) values (
    org_id, auth.uid(), btrim(target_payload->>'legalName'), btrim(target_payload->>'brandName'), btrim(target_payload->>'companyType'),
    btrim(target_payload->>'registeredCountry'), btrim(target_payload->>'registeredAddress'), btrim(target_payload->>'representativeName'),
    nullif(btrim(target_payload->>'representativeJobTitle'), ''), nullif(lower(btrim(target_payload->>'representativeEmail')), ''),
    nullif(btrim(target_payload->>'representativePhone'), ''), nullif(btrim(target_payload->>'companyDescription'), ''),
    nullif(btrim(target_payload->>'advertisingPurpose'), ''), nullif(btrim(target_payload->>'partnershipPurpose'), ''),
    nullif(btrim(target_payload->>'productsOrServicesSummary'), ''),
    nullif(btrim(target_payload->>'industry'), ''), nullif(btrim(target_payload->>'industryCode'), ''),
    nullif(btrim(target_payload->>'officialWebsite'), ''), case
      when nullif(btrim(target_payload->>'corporateEmailDomain'), '') is null then null
      else public.business_normalize_domain(target_payload->>'corporateEmailDomain')
    end,
    nullif(btrim(target_payload->>'idempotencyKey'), ''), 'draft'
  ) on conflict (applicant_user_id, idempotency_key) where idempotency_key is not null do update
    set legal_name = excluded.legal_name, brand_name = excluded.brand_name, company_type = excluded.company_type,
      registered_country = excluded.registered_country, registered_address = excluded.registered_address,
      representative_name = excluded.representative_name, representative_job_title = excluded.representative_job_title,
      representative_email = excluded.representative_email, representative_phone = excluded.representative_phone,
      company_description = excluded.company_description, advertising_purpose = excluded.advertising_purpose,
      partnership_purpose = excluded.partnership_purpose, products_or_services_summary = excluded.products_or_services_summary,
      industry = excluded.industry, industry_code = excluded.industry_code, official_website = excluded.official_website,
      corporate_email_domain = excluded.corporate_email_domain, updated_at = now()
    where public.business_applications.status in ('draft', 'requires_information')
  returning id into app_id;
  return app_id;
end;
$$;

create or replace function public.submit_business_application_snapshot(target_application_id uuid, target_idempotency_key text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare app public.business_applications%rowtype; payload jsonb; submission_id uuid; active_legal_count integer; payload_digest text;
begin
  select * into app from public.business_applications where id = target_application_id for update;
  if app.id is null then raise exception 'BUSINESS_APPLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.has_organization_role(app.organization_id, array['organization_owner', 'business_admin']) then raise exception 'BUSINESS_APPLICATION_FORBIDDEN' using errcode = '42501'; end if;
  select count(*) into active_legal_count from public.business_legal_document_versions where status = 'active' and (effective_at is null or effective_at <= now());
  if active_legal_count < 5 then raise exception 'LEGAL_COPY_REQUIRED' using errcode = 'P0001'; end if;
  if app.representative_email is null or public.business_is_consumer_email_domain(split_part(app.representative_email, '@', 2)) then raise exception 'BUSINESS_EMAIL_REQUIRED' using errcode = '22023'; end if;
  -- Snapshot retains legal fields for Root review. Public/applicant DTOs strip them separately.
  payload := jsonb_strip_nulls(to_jsonb(app) - array['internal_review_notes']);
  payload_digest := encode(extensions.digest(payload::text, 'sha256'), 'hex');
  update public.business_applications set status = 'submitted', submitted_at = now(), submission_version = submission_version + 1,
    idempotency_key = coalesce(nullif(btrim(target_idempotency_key), ''), idempotency_key) where id = app.id returning * into app;
  insert into public.business_application_submissions (application_id, organization_id, submission_version, submitted_payload, payload_hash, submitted_by)
  values (app.id, app.organization_id, app.submission_version, payload, payload_digest, auth.uid()) returning id into submission_id;
  return submission_id;
end;
$$;

create or replace function public.create_organization_invitation(
  target_organization_id uuid, target_email text, target_role text, target_token_hash text, target_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare invitation_id uuid; normalized_email text := lower(btrim(target_email));
begin
  if not public.has_organization_role(target_organization_id, array['organization_owner']) then raise exception 'ORGANIZATION_OWNER_REQUIRED' using errcode = '42501'; end if;
  if exists (select 1 from public.organizations where id = target_organization_id and status = 'suspended') then
    raise exception 'ORGANIZATION_SUSPENDED' using errcode = '42501';
  end if;
  if target_role = 'organization_owner' then raise exception 'OWNERSHIP_TRANSFER_REQUIRED' using errcode = '22023'; end if;
  if target_role not in ('business_admin', 'billing_admin', 'campaign_manager', 'brand_manager', 'content_manager', 'analyst', 'support_contact') then
    raise exception 'ORGANIZATION_INVITATION_ROLE_INVALID' using errcode = '22023';
  end if;
  if normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or target_token_hash !~ '^[a-f0-9]{64}$' or target_expires_at <= now() then raise exception 'ORGANIZATION_INVITATION_INVALID' using errcode = '22023'; end if;
  if not public.business_consume_rate_limit(target_organization_id, 'organization_invitation', 20, 3600) then
    raise exception 'ORGANIZATION_INVITATION_RATE_LIMITED' using errcode = '54000';
  end if;
  insert into public.organization_invitations (organization_id, invited_email, invited_email_normalized, invited_role, invited_by, token_hash, expires_at)
  values (target_organization_id, normalized_email, normalized_email, target_role, auth.uid(), target_token_hash, target_expires_at)
  returning id into invitation_id;
  return invitation_id;
end;
$$;

create or replace function public.accept_organization_invitation(target_token_hash text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare invite public.organization_invitations%rowtype; actor_email text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select lower(email) into actor_email from auth.users where id = auth.uid();
  select * into invite from public.organization_invitations where token_hash = target_token_hash for update;
  if invite.id is null or invite.status <> 'pending' or invite.expires_at <= now() then raise exception 'ORGANIZATION_INVITATION_INVALID_OR_EXPIRED' using errcode = '42501'; end if;
  if actor_email <> invite.invited_email_normalized then raise exception 'ORGANIZATION_INVITATION_EMAIL_MISMATCH' using errcode = '42501'; end if;
  insert into public.organization_members (organization_id, user_id, role, created_by) values (invite.organization_id, auth.uid(), invite.invited_role, invite.invited_by)
  on conflict (organization_id, user_id) do update set role = excluded.role, updated_at = now();
  update public.organization_invitations set status = 'accepted', accepted_by = auth.uid(), invited_user_id = auth.uid(), accepted_at = now(), token_hash = null where id = invite.id;
  return invite.organization_id;
end;
$$;

create or replace function public.start_organization_ownership_transfer(
  target_organization_id uuid, target_user_id uuid, target_token_hash text, target_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare transfer_id uuid;
begin
  if not public.has_organization_role(target_organization_id, array['organization_owner']) then raise exception 'ORGANIZATION_OWNER_REQUIRED' using errcode = '42501'; end if;
  if not exists (select 1 from public.organization_members where organization_id = target_organization_id and user_id = target_user_id) then raise exception 'ORGANIZATION_MEMBER_REQUIRED' using errcode = '42501'; end if;
  insert into public.organization_ownership_transfers (organization_id, from_user_id, to_user_id, token_hash, expires_at)
  values (target_organization_id, auth.uid(), target_user_id, target_token_hash, target_expires_at) returning id into transfer_id;
  return transfer_id;
end;
$$;

create or replace function public.accept_organization_ownership_transfer(target_token_hash text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare transfer public.organization_ownership_transfers%rowtype;
begin
  select * into transfer from public.organization_ownership_transfers where token_hash = target_token_hash for update;
  if transfer.id is null or transfer.status <> 'pending' or transfer.expires_at <= now() or transfer.to_user_id <> auth.uid() then raise exception 'OWNERSHIP_TRANSFER_INVALID_OR_EXPIRED' using errcode = '42501'; end if;
  update public.organization_members set role = 'organization_owner', updated_at = now() where organization_id = transfer.organization_id and user_id = transfer.to_user_id;
  update public.organization_members set role = 'business_admin', updated_at = now() where organization_id = transfer.organization_id and user_id = transfer.from_user_id;
  update public.organization_ownership_transfers set status = 'accepted', accepted_at = now(), token_hash = repeat('0', 64) where id = transfer.id;
  return transfer.organization_id;
end;
$$;

create or replace function public.remove_organization_member_safe(target_organization_id uuid, target_user_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare target_role text;
begin
  if not public.has_organization_role(target_organization_id, array['organization_owner']) then raise exception 'ORGANIZATION_OWNER_REQUIRED' using errcode = '42501'; end if;
  select role into target_role from public.organization_members where organization_id = target_organization_id and user_id = target_user_id for update;
  if target_role = 'organization_owner' and not exists (select 1 from public.organization_members where organization_id = target_organization_id and role = 'organization_owner' and user_id <> target_user_id) then raise exception 'ORGANIZATION_OWNER_REQUIRED' using errcode = '23514'; end if;
  delete from public.organization_members where organization_id = target_organization_id and user_id = target_user_id;
end;
$$;

create or replace function public.follow_business_profile(target_organization_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not exists (select 1 from public.business_profiles p where p.organization_id = target_organization_id and p.public_status = 'published')
     or not public.organization_has_active_business_badge(target_organization_id) then raise exception 'BUSINESS_PROFILE_NOT_FOLLOWABLE' using errcode = '42501'; end if;
  insert into public.business_profile_followers (organization_id, user_id) values (target_organization_id, auth.uid()) on conflict do nothing;
end;
$$;

create or replace function public.unfollow_business_profile(target_organization_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin delete from public.business_profile_followers where organization_id = target_organization_id and user_id = auth.uid(); end;
$$;

create or replace function public.request_business_domain_verification(target_organization_id uuid, target_domain text, target_method text default 'dns_txt')
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare verification_id uuid; domain_value text := public.business_normalize_domain(target_domain);
begin
  if not public.has_organization_role(target_organization_id, array['organization_owner', 'business_admin']) then raise exception 'BUSINESS_DOMAIN_FORBIDDEN' using errcode = '42501'; end if;
  if public.business_is_consumer_email_domain(domain_value) then raise exception 'BUSINESS_DOMAIN_CONSUMER_FORBIDDEN' using errcode = '22023'; end if;
  insert into public.business_domain_verifications (organization_id, domain, verification_method, requested_by, challenge_token_hash, expires_at)
  values (target_organization_id, domain_value, target_method, auth.uid(), encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'), now() + interval '7 days')
  on conflict (organization_id, domain) do update set status = 'pending', requested_by = excluded.requested_by, expires_at = excluded.expires_at
  returning id into verification_id;
  return verification_id;
end;
$$;

create or replace function public.create_business_document_record(
  target_application_id uuid, target_document_type text, target_file_name text, target_mime_type text, target_storage_path text, target_sha256 text
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare app public.business_applications%rowtype; document_id uuid;
begin
  select * into app from public.business_applications where id = target_application_id;
  if app.id is null or not public.has_organization_role(app.organization_id, array['organization_owner', 'business_admin']) then raise exception 'BUSINESS_DOCUMENT_FORBIDDEN' using errcode = '42501'; end if;
  if target_storage_path !~ ('^business-applications/' || app.organization_id::text || '/' || app.id::text || '/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$') then raise exception 'BUSINESS_DOCUMENT_PATH_INVALID' using errcode = '22023'; end if;
  insert into public.business_application_documents (application_id, organization_id, document_type, file_name, mime_type, storage_path, sha256, uploaded_by)
  values (app.id, app.organization_id, btrim(target_document_type), btrim(target_file_name), target_mime_type, target_storage_path, lower(target_sha256), auth.uid())
  returning id into document_id;
  return document_id;
end;
$$;

create or replace function public.complete_business_document_upload(target_document_id uuid, target_sha256 text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.business_application_documents d set malware_scan_status = 'pending'
  where d.id = target_document_id and d.sha256 = lower(target_sha256)
    and public.has_organization_role(d.organization_id, array['organization_owner', 'business_admin']);
  if not found then raise exception 'BUSINESS_DOCUMENT_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501'; end if;
end;
$$;

create or replace function public.get_business_application_applicant_dto(target_application_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare app public.business_applications%rowtype;
begin
  select * into app from public.business_applications where id = target_application_id;
  if app.id is null or not (app.applicant_user_id = auth.uid() or public.has_organization_role(app.organization_id, array['organization_owner', 'business_admin'])) then raise exception 'BUSINESS_APPLICATION_FORBIDDEN' using errcode = '42501'; end if;
  return jsonb_build_object('id', app.id, 'organizationId', app.organization_id, 'legalName', app.legal_name, 'brandName', app.brand_name,
    'companyType', app.company_type, 'registeredCountry', app.registered_country, 'officialWebsite', app.official_website,
    'corporateEmailDomain', app.corporate_email_domain, 'representativeName', app.representative_name, 'representativeJobTitle', app.representative_job_title,
    'industry', app.industry, 'industryCode', app.industry_code, 'status', app.status, 'submissionVersion', app.submission_version,
    'publicDecisionReason', app.public_decision_reason, 'submittedAt', app.submitted_at, 'reviewedAt', app.reviewed_at);
end;
$$;

create or replace function public.get_business_application_admin_dto(target_application_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not coalesce(public.is_root_owner(), false) then raise exception 'ROOT_OWNER_REQUIRED' using errcode = '42501'; end if;
  return (select to_jsonb(a) from public.business_applications a where a.id = target_application_id);
end;
$$;

create or replace function public.list_admin_business_applications()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not coalesce(public.is_root_owner(), false) then raise exception 'ROOT_OWNER_REQUIRED' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(a) order by a.updated_at desc) from public.business_applications a), '[]'::jsonb);
end;
$$;

create or replace function public.get_public_business_profile_bundle(target_slug text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'organizationId', p.organization_id,
      'slug', p.slug,
      'displayName', p.display_name,
      'bio', p.bio,
      'description', p.description,
      'websiteUrl', p.website_url,
      'supportUrl', p.support_url,
      'publicContactEmail', p.public_contact_email,
      'industry', p.industry,
      'foundedYear', p.founded_year,
      'headquartersCountry', p.headquarters_country,
      'profileLogoAssetId', p.profile_logo_asset_id,
      'coverAssetId', p.cover_asset_id,
      'followerCount', (select count(*)::integer from public.business_profile_followers f where f.organization_id = p.organization_id),
      'verifiedBusiness', true
    ),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', product.id, 'name', product.name, 'slug', product.slug,
        'summary', product.short_description, 'status', product.status, 'publishedAt', product.published_at
      ) order by product.published_at desc)
      from public.business_products product
      where product.organization_id = p.organization_id
        and product.status = 'published'
        and product.moderation_status = 'approved'
    ), '[]'::jsonb),
    'posts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', post.id, 'postType', post.post_type, 'body', post.body, 'status', post.status, 'publishedAt', post.published_at
      ) order by post.published_at desc)
      from public.business_posts post
      where post.organization_id = p.organization_id and post.status = 'published'
        and post.sponsorship_state = 'organic'
    ), '[]'::jsonb)
  )
  from public.business_profiles p
  join public.organizations o on o.id = p.organization_id
  where p.slug = lower(btrim(target_slug))
    and p.public_status = 'published'
    and o.status = 'active'
    and public.organization_has_active_business_badge(p.organization_id)
    and exists (
      select 1 from public.business_applications a
      where a.organization_id = p.organization_id and a.status = 'approved'
    );
$$;

create or replace function public.publish_business_profile(target_organization_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.has_organization_role(target_organization_id, array['organization_owner', 'business_admin', 'brand_manager']) then raise exception 'BUSINESS_PROFILE_FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.organizations where id = target_organization_id and status = 'active') then raise exception 'ORGANIZATION_NOT_ACTIVE' using errcode = '42501'; end if;
  if not public.organization_has_active_business_badge(target_organization_id) then raise exception 'BUSINESS_VERIFICATION_REQUIRED' using errcode = '42501'; end if;
  update public.business_profiles set public_status = 'published', published_at = now(), updated_at = now() where organization_id = target_organization_id;
  if not found then raise exception 'BUSINESS_PROFILE_NOT_FOUND' using errcode = 'P0002'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Private storage buckets and object policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('business-verification-documents', 'business-verification-documents', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('business-profile-assets', 'business-profile-assets', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists business_verification_documents_select on storage.objects;
drop policy if exists business_verification_documents_insert on storage.objects;
drop policy if exists business_profile_assets_select on storage.objects;
drop policy if exists business_profile_assets_write on storage.objects;
create policy business_verification_documents_select on storage.objects for select to authenticated using (
  bucket_id = 'business-verification-documents' and exists (
    select 1 from public.business_application_documents d
    where d.storage_path = name and (public.has_organization_role(d.organization_id, array['organization_owner', 'business_admin']) or public.is_root_owner())
  )
);
create policy business_verification_documents_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'business-verification-documents' and name ~ '^business-applications/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$'
  and public.has_organization_role((storage.foldername(name))[2]::uuid, array['organization_owner', 'business_admin'])
);
create policy business_profile_assets_select on storage.objects for select to authenticated using (
  bucket_id = 'business-profile-assets' and exists (
    select 1 from public.brand_assets a where a.storage_path = name
      and (public.can_manage_organization_content(a.organization_id) or public.is_root_owner())
  )
);
create policy business_profile_assets_write on storage.objects for all to authenticated using (
  bucket_id = 'business-profile-assets' and public.has_organization_role((storage.foldername(name))[2]::uuid, array['organization_owner', 'business_admin', 'brand_manager'])
) with check (
  bucket_id = 'business-profile-assets' and name ~ '^organizations/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
  and public.has_organization_role((storage.foldername(name))[2]::uuid, array['organization_owner', 'business_admin', 'brand_manager'])
);

-- ---------------------------------------------------------------------------
-- RLS, policies, and grants. New tables have no client write policies.
-- ---------------------------------------------------------------------------
alter table public.business_application_submissions enable row level security;
alter table public.business_application_documents enable row level security;
alter table public.business_domain_verifications enable row level security;
alter table public.business_profile_followers enable row level security;
alter table public.organization_ownership_transfers enable row level security;
alter table public.business_legal_acceptances enable row level security;
alter table public.business_legal_document_versions enable row level security;
alter table public.business_rate_limits enable row level security;
alter table public.business_risk_flags enable row level security;

create policy business_application_documents_member_select on public.business_application_documents for select to authenticated
  using (public.has_organization_role(organization_id, array['organization_owner', 'business_admin']) or public.is_root_owner());
create policy business_domain_verifications_member_select on public.business_domain_verifications for select to authenticated
  using (public.has_organization_role(organization_id, array['organization_owner', 'business_admin']) or public.is_root_owner());
create policy business_profile_followers_self_select on public.business_profile_followers for select to authenticated using (user_id = auth.uid());
create policy business_legal_acceptances_member_select on public.business_legal_acceptances for select to authenticated
  using (public.has_organization_role(organization_id, array['organization_owner', 'business_admin']) or public.is_root_owner());
create policy business_legal_versions_authenticated_select on public.business_legal_document_versions for select to authenticated using (status = 'active');
create policy business_submissions_root_select on public.business_application_submissions for select to authenticated using (public.is_root_owner());
create policy business_risk_flags_root_select on public.business_risk_flags for select to authenticated using (public.is_root_owner());
create policy business_transfers_party_select on public.organization_ownership_transfers for select to authenticated using (from_user_id = auth.uid() or to_user_id = auth.uid());

revoke all on public.business_application_submissions, public.business_application_documents, public.business_domain_verifications,
  public.business_profile_followers, public.organization_ownership_transfers, public.business_legal_acceptances,
  public.business_legal_document_versions, public.business_rate_limits, public.business_risk_flags from public, anon, authenticated;
grant select on public.business_application_submissions, public.business_application_documents, public.business_domain_verifications,
  public.business_profile_followers, public.organization_ownership_transfers, public.business_legal_acceptances,
  public.business_legal_document_versions, public.business_risk_flags to authenticated;

revoke all on function public.business_prevent_submission_mutation(), public.business_normalize_domain(text),
  public.business_is_consumer_email_domain(text), public.business_application_transition_allowed(text, text),
  public.business_application_has_pending_malware(uuid), public.organization_has_active_business_badge(uuid),
  public.business_consume_rate_limit(uuid, text, integer, integer), public.reconcile_business_organization_entitlements(uuid, text),
  public.approve_business_application(uuid, text, text, text), public.transition_business_application(uuid, text, text, text),
  public.upsert_business_application_draft(jsonb), public.submit_business_application_snapshot(uuid, text),
  public.create_organization_invitation(uuid, text, text, text, timestamptz), public.accept_organization_invitation(text),
  public.start_organization_ownership_transfer(uuid, uuid, text, timestamptz), public.accept_organization_ownership_transfer(text),
  public.remove_organization_member_safe(uuid, uuid), public.follow_business_profile(uuid), public.unfollow_business_profile(uuid),
  public.request_business_domain_verification(uuid, text, text), public.create_business_document_record(uuid, text, text, text, text, text),
  public.complete_business_document_upload(uuid, text), public.get_business_application_applicant_dto(uuid),
  public.get_business_application_admin_dto(uuid), public.list_admin_business_applications(), public.get_public_business_profile_bundle(text)
from public, anon, authenticated;

grant execute on function public.business_normalize_domain(text), public.business_is_consumer_email_domain(text),
  public.upsert_business_application_draft(jsonb), public.submit_business_application_snapshot(uuid, text),
  public.create_organization_invitation(uuid, text, text, text, timestamptz), public.accept_organization_invitation(text),
  public.start_organization_ownership_transfer(uuid, uuid, text, timestamptz), public.accept_organization_ownership_transfer(text),
  public.remove_organization_member_safe(uuid, uuid), public.follow_business_profile(uuid), public.unfollow_business_profile(uuid),
  public.request_business_domain_verification(uuid, text, text), public.create_business_document_record(uuid, text, text, text, text, text),
  public.complete_business_document_upload(uuid, text), public.get_business_application_applicant_dto(uuid),
  public.get_business_application_admin_dto(uuid), public.list_admin_business_applications(), public.get_public_business_profile_bundle(text),
  public.publish_business_profile(uuid) to authenticated;
grant execute on function public.reconcile_business_organization_entitlements(uuid, text) to service_role;
-- This predicate backs public, security-barrier catalog/profile views. It only answers
-- whether the organization has the public business-verification state required by those views.
grant execute on function public.organization_has_active_business_badge(uuid) to anon, authenticated;
grant execute on function public.get_public_business_profile_bundle(text) to anon;

drop trigger if exists business_application_submissions_append_only on public.business_application_submissions;
create trigger business_application_submissions_append_only before update or delete on public.business_application_submissions
for each row execute function public.business_prevent_submission_mutation();

commit;
