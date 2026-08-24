-- Harden PICOM public business/verification views so they run as the caller.
--
-- PostgreSQL views default to owner privileges (SECURITY DEFINER). These six
-- views are owned by postgres, so they previously bypassed underlying RLS.
-- security_invoker = true makes table RLS and column grants authoritative.
-- security_barrier is retained so the view predicate is applied before
-- user-supplied qualifiers.
--
-- Do not DROP these views: dependents and PostgREST contracts stay in place.
-- Column lists are not rewritten here because hosted production and later
-- catalog migrations currently diverge.

begin;

create or replace function public.picom_tmp_grant_select_columns(
  target_table regclass,
  target_roles text[],
  allowed_columns text[]
)
returns void
language plpgsql
set search_path = pg_catalog
as $$
declare
  cols text;
  role_name text;
begin
  select string_agg(format('%I', a.attname), ', ' order by a.attnum)
  into cols
  from pg_attribute a
  where a.attrelid = target_table
    and a.attnum > 0
    and not a.attisdropped
    and a.attname = any(allowed_columns);

  if cols is null then
    raise exception 'PICOM_GRANT_SELECT_COLUMNS_EMPTY %', target_table;
  end if;

  foreach role_name in array target_roles loop
    execute format('grant select (%s) on %s to %I', cols, target_table, role_name);
  end loop;
end;
$$;

revoke all on function public.picom_tmp_grant_select_columns(regclass, text[], text[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Views: keep names/columns, switch to invoker security
-- ---------------------------------------------------------------------------
do $$
declare
  view_name text;
  view_comment text;
begin
  foreach view_name in array array[
    'public_profile_badges',
    'public_business_profiles',
    'public_brand_assets',
    'public_business_products',
    'public_business_posts',
    'business_application_owner_views',
    'billing_catalog_public'
  ] loop
    if to_regclass(format('public.%I', view_name)) is null then
      continue;
    end if;

    execute format(
      'alter view public.%I set (security_invoker = true, security_barrier = true)',
      view_name
    );

    view_comment := case view_name
      when 'public_profile_badges' then
        'Active public badges only. security_invoker is required so verification_badges RLS applies instead of the postgres owner bypass.'
      when 'public_business_profiles' then
        'Published business profiles of active organizations. security_invoker is required so business_profiles/organizations RLS is authoritative.'
      when 'public_brand_assets' then
        'Active brand assets for publicly published businesses. security_invoker is required so brand_assets RLS cannot be bypassed.'
      when 'public_business_products' then
        'Published, approved business products. security_invoker is required so business_products RLS is authoritative.'
      when 'public_business_posts' then
        'Published organic business posts. security_invoker is required so business_posts RLS is authoritative.'
      when 'business_application_owner_views' then
        'Owner/applicant application surface that omits internal review fields. security_invoker is required so business_applications RLS is authoritative.'
      else
        'Public PICOM Verified price catalog without provider IDs. security_invoker is required so billing_products RLS is authoritative.'
    end;

    execute format('comment on view public.%I is %L', view_name, view_comment);

    execute format('revoke all on public.%I from public, anon, authenticated', view_name);
    if view_name = 'business_application_owner_views' then
      execute format('grant select on public.%I to authenticated', view_name);
    elsif view_name = 'billing_catalog_public' then
      execute format('grant select on public.%I to authenticated', view_name);
    else
      execute format('grant select on public.%I to anon, authenticated', view_name);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Underlying RLS: allow exactly the rows the public/owner views already filter
-- ---------------------------------------------------------------------------
drop policy if exists verification_business_badges_public_select on public.verification_badges;
create policy verification_business_badges_public_select
on public.verification_badges
for select
to anon, authenticated
using (
  status = 'active'
  and revoked_at is null
  and (expires_at is null or expires_at > now())
);

drop policy if exists verification_business_organizations_public_select on public.organizations;
create policy verification_business_organizations_public_select
on public.organizations
for select
to anon, authenticated
using (status = 'active');

drop policy if exists verification_business_profiles_public_select on public.business_profiles;
create policy verification_business_profiles_public_select
on public.business_profiles
for select
to anon, authenticated
using (
  public_status = 'published'
  and exists (
    select 1
    from public.organizations organization
    where organization.id = organization_id
      and organization.status = 'active'
  )
);

drop policy if exists verification_business_assets_public_select on public.brand_assets;
create policy verification_business_assets_public_select
on public.brand_assets
for select
to anon, authenticated
using (
  status = 'active'
  and exists (
    select 1
    from public.business_profiles profile
    join public.organizations organization on organization.id = profile.organization_id
    where profile.organization_id = brand_assets.organization_id
      and profile.public_status = 'published'
      and organization.status = 'active'
  )
);

drop policy if exists verification_business_products_public_select on public.business_products;
create policy verification_business_products_public_select
on public.business_products
for select
to anon, authenticated
using (
  status = 'published'
  and moderation_status = 'approved'
  and exists (
    select 1
    from public.organizations organization
    where organization.id = organization_id
      and organization.status = 'active'
  )
);

drop policy if exists verification_business_posts_public_select on public.business_posts;
create policy verification_business_posts_public_select
on public.business_posts
for select
to anon, authenticated
using (
  status = 'published'
  and sponsorship_state = 'organic'
  and exists (
    select 1
    from public.organizations organization
    where organization.id = organization_id
      and organization.status = 'active'
  )
);

drop policy if exists verification_business_applications_owner_select on public.business_applications;
create policy verification_business_applications_owner_select
on public.business_applications
for select
to authenticated
using (
  applicant_user_id = auth.uid()
  or public.has_organization_role(organization_id, array['organization_owner', 'business_admin'])
  or public.verification_business_is_platform_admin()
);

-- ---------------------------------------------------------------------------
-- Column grants: invoker views need table/column privilege, but private
-- fields must remain unreadable through direct table access.
-- ---------------------------------------------------------------------------
revoke select on public.verification_badges, public.organizations, public.business_profiles,
  public.brand_assets, public.business_products, public.business_posts, public.business_applications
from public, anon, authenticated;

select public.picom_tmp_grant_select_columns(
  'public.verification_badges',
  array['anon', 'authenticated'],
  array[
    'id', 'subject_type', 'subject_id', 'badge_kind', 'status', 'granted_at',
    'expires_at', 'revoked_at', 'public_reason_code', 'is_primary'
  ]
);

select public.picom_tmp_grant_select_columns(
  'public.organizations',
  array['anon'],
  array['id', 'status']
);

select public.picom_tmp_grant_select_columns(
  'public.organizations',
  array['authenticated'],
  array['id', 'display_name', 'status', 'created_at', 'updated_at']
);

select public.picom_tmp_grant_select_columns(
  'public.business_profiles',
  array['anon', 'authenticated'],
  array[
    'organization_id', 'slug', 'display_name', 'bio', 'description', 'website_url',
    'support_url', 'public_contact_email', 'industry', 'founded_year',
    'headquarters_country', 'profile_logo_asset_id', 'cover_asset_id',
    'primary_color', 'secondary_color', 'public_status', 'published_at'
  ]
);

select public.picom_tmp_grant_select_columns(
  'public.brand_assets',
  array['anon', 'authenticated'],
  array[
    'id', 'organization_id', 'asset_type', 'storage_path', 'mime_type',
    'width', 'height', 'version', 'status', 'created_at'
  ]
);

select public.picom_tmp_grant_select_columns(
  'public.business_products',
  array['anon', 'authenticated'],
  array[
    'id', 'organization_id', 'name', 'slug', 'short_description', 'description',
    'product_type', 'sku', 'price_display_mode', 'price_amount_minor',
    'compare_at_price_amount_minor', 'currency', 'availability', 'availability_text',
    'purchase_url', 'product_url', 'support_url', 'status', 'moderation_status',
    'published_at'
  ]
);

select public.picom_tmp_grant_select_columns(
  'public.business_posts',
  array['anon', 'authenticated'],
  array[
    'id', 'organization_id', 'post_type', 'body', 'status', 'sponsorship_state',
    'publishing_status', 'commercial_disclosure_state', 'published_at', 'created_at'
  ]
);

select public.picom_tmp_grant_select_columns(
  'public.business_applications',
  array['authenticated'],
  array[
    'id', 'organization_id', 'applicant_user_id', 'legal_name', 'brand_name',
    'company_type', 'registered_country', 'official_website', 'corporate_email_domain',
    'representative_name', 'industry', 'status', 'submitted_at', 'reviewed_at',
    'public_decision_reason', 'created_at', 'updated_at'
  ]
);

do $$
begin
  if to_regclass('public.billing_products') is not null
     and to_regclass('public.billing_catalog_public') is not null then
    execute 'drop policy if exists billing_products_public_catalog_select on public.billing_products';
    execute $sql$
      create policy billing_products_public_catalog_select
      on public.billing_products
      for select
      to authenticated
      using (status = 'active' and product_key = 'picom_verified')
    $sql$;
    execute 'revoke select on public.billing_products from public, anon, authenticated';
    perform public.picom_tmp_grant_select_columns(
      'public.billing_products',
      array['authenticated'],
      array[
        'plan_key', 'billing_interval', 'interval_count', 'currency',
        'amount_minor', 'status', 'effective_from', 'effective_until', 'product_key'
      ]
    );
  end if;
end;
$$;

drop function public.picom_tmp_grant_select_columns(regclass, text[], text[]);

commit;
