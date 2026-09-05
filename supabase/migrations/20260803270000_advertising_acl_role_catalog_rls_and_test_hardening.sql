-- TASK 08C: advertising transition ACL, platform_role_catalog RLS, finance client write lockdown.
-- Additive only. Does not modify 20260803240000 body.

-- ---------------------------------------------------------------------------
-- 1) ads_allow_internal_transition + payout_allow_internal_transition ACL
-- ---------------------------------------------------------------------------
revoke all on function public.ads_allow_internal_transition() from public, anon, authenticated;
revoke all on function public.payout_allow_internal_transition() from public, anon, authenticated;
grant execute on function public.ads_allow_internal_transition() to service_role;
grant execute on function public.payout_allow_internal_transition() to service_role;
-- Owner (postgres) retains execute by ownership for SECURITY DEFINER trigger callers.

comment on function public.ads_allow_internal_transition() is
  'Internal GUC gate for ads transition triggers. Not executable by anon/authenticated/PUBLIC.';

comment on function public.payout_allow_internal_transition() is
  'Internal GUC gate for payout transition triggers. Not executable by anon/authenticated/PUBLIC.';

-- ---------------------------------------------------------------------------
-- 2) platform_role_catalog RLS
-- ---------------------------------------------------------------------------
alter table public.platform_role_catalog enable row level security;

revoke all on table public.platform_role_catalog from public, anon, authenticated;

drop policy if exists platform_role_catalog_admin_select on public.platform_role_catalog;
create policy platform_role_catalog_admin_select
  on public.platform_role_catalog
  for select
  to authenticated
  using (
    public.is_root_owner()
    or public.has_platform_role('platform_admin')
    or public.has_platform_role('root_owner')
  );

-- No insert/update/delete policies for client roles; writes remain migration/service_role only.
grant select on table public.platform_role_catalog to authenticated;
grant all on table public.platform_role_catalog to service_role;

create or replace view public.platform_role_catalog_public_safe
with (security_invoker = true)
as
select
  role_key,
  label,
  description,
  created_at
from public.platform_role_catalog;

revoke all on public.platform_role_catalog_public_safe from public, anon;
grant select on public.platform_role_catalog_public_safe to authenticated, service_role;

comment on view public.platform_role_catalog_public_safe is
  'Allowlisted role catalog columns for authenticated operators; RLS on base table still applies via security_invoker.';

-- ---------------------------------------------------------------------------
-- 3) Harden residual client write privileges on finance-sensitive tables
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger
  on table public.tax_profiles
  from public, anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
  on table public.payout_profiles
  from public, anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
  on table public.ad_spend_ledger, public.payout_batches, public.payout_items, public.payout_item_accruals
  from public, anon, authenticated;

-- Ensure SELECT-only where product policies already exist.
grant select on table public.tax_profiles to authenticated;
grant select on table public.payout_profiles to authenticated;
