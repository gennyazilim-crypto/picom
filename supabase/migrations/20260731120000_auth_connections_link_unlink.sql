-- Account Connections: session-bound Steam/Epic link handoffs, own-identity listing,
-- provider audit events, and security-email enqueue for link/unlink.

begin;

-- ---------------------------------------------------------------------------
-- Link-purpose handoffs (Steam/Epic attach to an existing authenticated user)
-- ---------------------------------------------------------------------------
alter table public.social_auth_handoffs
  add column if not exists purpose text not null default 'login'
    check (purpose in ('login', 'link'));

alter table public.social_auth_handoffs
  add column if not exists link_user_id uuid references auth.users(id) on delete cascade;

create index if not exists social_auth_handoffs_link_user_id_idx
  on public.social_auth_handoffs (link_user_id)
  where link_user_id is not null;

comment on column public.social_auth_handoffs.purpose is
  'login = mint new/existing mapped session; link = bind provider identity to link_user_id.';
comment on column public.social_auth_handoffs.link_user_id is
  'Authenticated Picom user for purpose=link. Never trust client-supplied user_id alone.';

-- ---------------------------------------------------------------------------
-- Authenticated read of own external identities (no tokens)
-- ---------------------------------------------------------------------------
create or replace function public.list_my_social_auth_external_identities()
returns table (
  provider text,
  external_id text,
  linked_at timestamptz,
  last_used_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    i.provider,
    i.external_id,
    i.created_at as linked_at,
    i.last_used_at
  from public.social_auth_external_identities i
  where i.user_id = auth.uid();
$$;

revoke all on function public.list_my_social_auth_external_identities() from public, anon;
grant execute on function public.list_my_social_auth_external_identities() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Audit event types for provider link/unlink
-- ---------------------------------------------------------------------------
alter table public.account_security_events drop constraint if exists account_security_events_event_type_check;
alter table public.account_security_events
  add constraint account_security_events_event_type_check
  check (event_type in (
    'account_deletion_requested',
    'account_deletion_canceled',
    'account_sessions_revoked',
    'account_profile_anonymized',
    'account_auth_soft_deleted',
    'account_registered',
    'profile_completed',
    'password_changed',
    'email_change_requested',
    'mfa_enabled',
    'mfa_disabled',
    'login_new_device',
    'account_deactivated',
    'account_reactivated',
    'profile_verification_submitted',
    'account_anonymized',
    'email_verification_created',
    'email_verification_sent',
    'email_verification_resent',
    'email_verification_delivery_failed',
    'email_verification_completed',
    'email_verification_expired',
    'email_verification_invalid_token',
    'email_verification_rate_limited',
    'email_address_changed',
    'email_verification_reminder_shown',
    'provider_linked',
    'provider_unlinked',
    'provider_link_failed',
    'provider_login',
    'session_revoked'
  ));

-- ---------------------------------------------------------------------------
-- Security emails for provider link/unlink (idempotent per event id)
-- ---------------------------------------------------------------------------
create or replace function public.queue_account_security_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  event_summary text;
  template_id text;
  provider_label text;
begin
  provider_label := coalesce(nullif(new.metadata->>'provider', ''), 'a sign-in provider');

  event_summary := case new.event_type
    when 'account_deletion_requested' then 'An account deletion request was created. Review account security if you did not request this.'
    when 'account_deletion_canceled' then 'Your account deletion request was canceled.'
    when 'account_sessions_revoked' then 'All other Picom sessions were revoked for your protection.'
    when 'provider_linked' then 'A sign-in provider (' || provider_label || ') was linked to your Picom account.'
    when 'provider_unlinked' then 'A sign-in provider (' || provider_label || ') was removed from your Picom account.'
    when 'provider_link_failed' then 'A sign-in provider link attempt failed for your Picom account.'
    else null
  end;
  if event_summary is null then return new; end if;

  template_id := case
    when new.event_type in ('provider_linked', 'provider_unlinked', 'provider_link_failed')
      then 'security_settings_changed'
    when new.event_type = 'account_sessions_revoked'
      then 'security_alert'
    else 'security_settings_changed'
  end;

  perform public.enqueue_email_for_user_event(
    new.user_id,
    template_id,
    'required_account_security',
    jsonb_build_object(
      'summary', event_summary,
      'reference', new.event_type,
      'actionUrl', 'https://account.picom.gg/account/connections',
      'actionLabel', 'Review connected accounts'
    ),
    'account-security:' || new.id::text,
    'account-security:' || new.id::text,
    95::smallint,
    'account_security_events',
    new.id::text
  );
  return new;
end;
$$;

-- Authenticated clients may record own provider unlink after Supabase unlinkIdentity succeeds.
create or replace function public.audit_provider_connection_change(
  target_provider text,
  target_event text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  event_id uuid;
  provider_norm text := lower(trim(target_provider));
  event_norm text := lower(trim(target_event));
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if provider_norm not in ('google', 'apple', 'steam', 'epic') then
    raise exception 'invalid provider';
  end if;
  if event_norm not in ('provider_linked', 'provider_unlinked', 'provider_link_failed') then
    raise exception 'invalid event';
  end if;

  insert into public.account_security_events(user_id, event_type, metadata)
  values (auth.uid(), event_norm, jsonb_build_object('provider', provider_norm))
  returning id into event_id;

  return event_id;
end;
$$;

revoke all on function public.audit_provider_connection_change(text, text) from public, anon;
grant execute on function public.audit_provider_connection_change(text, text) to authenticated, service_role;

commit;
