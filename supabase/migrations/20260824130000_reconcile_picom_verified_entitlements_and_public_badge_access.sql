-- Preserve the immutable Task 08 migration hashes while applying the later
-- entitlement function correction and public badge predicate grant forward.
-- Safe for databases that already received either historical file variant.
begin;

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

-- This predicate only exposes public badge state and is used by public
-- security-invoker catalog/profile views.
grant execute on function public.organization_has_active_business_badge(uuid) to anon, authenticated;

commit;
