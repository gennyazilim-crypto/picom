-- Hosted multi-role acceptance checks for root dashboard RPCs.
-- Run against a hosted Supabase project after applying migrations
-- 20260715140000_root_dashboard_operations_core.sql and
-- 20260715141000_root_dashboard_mutations_rbac_mfa.sql.

begin;

do $$
begin
  if to_regprocedure('public.is_root_owner()') is null then
    raise exception 'MISSING is_root_owner';
  end if;
  if to_regprocedure('public.has_platform_permission(text)') is null then
    raise exception 'MISSING has_platform_permission';
  end if;
  if to_regprocedure('public.list_root_dashboard_module_v1(text,timestamptz,text,integer)') is null then
    raise exception 'MISSING list_root_dashboard_module_v1';
  end if;
  if to_regprocedure('public.create_support_ticket(text,text,text,uuid,text[],text,text,uuid)') is null then
    raise exception 'MISSING create_support_ticket';
  end if;
  if to_regprocedure('public.create_privileged_step_up(text)') is null then
    raise exception 'MISSING create_privileged_step_up';
  end if;
  if to_regprocedure('public.require_or_consume_step_up(text,uuid)') is null then
    raise exception 'MISSING require_or_consume_step_up';
  end if;
  if to_regclass('public.support_tickets') is null then
    raise exception 'MISSING support_tickets';
  end if;
  if to_regclass('public.platform_role_assignments') is null then
    raise exception 'MISSING platform_role_assignments';
  end if;
  if to_regclass('public.privileged_step_up_challenges') is null then
    raise exception 'MISSING privileged_step_up_challenges';
  end if;
  if to_regclass('public.root_dashboard_audit') is null then
    raise exception 'MISSING root_dashboard_audit';
  end if;
end;
$$;

-- Deny-by-default: authenticated role must not have direct DML on privileged tables.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'support_tickets',
    'ad_campaigns',
    'subscription_records',
    'finance_approval_requests',
    'platform_incidents',
    'remote_feature_flags',
    'platform_role_assignments',
    'root_dashboard_audit',
    'privileged_step_up_challenges',
    'root_dashboard_export_jobs'
  ]
  loop
    if has_table_privilege('authenticated', format('public.%I', table_name), 'insert')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'update')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'delete') then
      raise exception 'DIRECT_DML_ALLOWED on %', table_name;
    end if;
  end loop;
end;
$$;

commit;
