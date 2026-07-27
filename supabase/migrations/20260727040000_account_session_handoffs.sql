-- One-time session handoff from Account Center → Desktop / Web product.
-- Tokens never go in deep-link URLs; clients poll or redeem a short nonce.

begin;

create table if not exists public.account_session_handoffs (
  nonce text primary key check (nonce ~ '^[A-Za-z0-9_-]{32,128}$'),
  status text not null default 'ready' check (status in ('ready', 'consumed')),
  session jsonb not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes')
);

create index if not exists idx_account_session_handoffs_expires_at
  on public.account_session_handoffs (expires_at);

alter table public.account_session_handoffs enable row level security;

revoke all on table public.account_session_handoffs from public, anon, authenticated;
grant select, insert, update, delete on table public.account_session_handoffs to service_role;

create or replace function public.consume_account_session_handoff(target_nonce text)
returns table(result_status text, result_session jsonb)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  handoff public.account_session_handoffs%rowtype;
begin
  if target_nonce is null or target_nonce !~ '^[A-Za-z0-9_-]{32,128}$' then
    return query select 'unknown'::text, null::jsonb;
    return;
  end if;

  select handoff_row.*
    into handoff
    from public.account_session_handoffs as handoff_row
    where handoff_row.nonce = target_nonce
    for update;

  if not found then
    return query select 'unknown'::text, null::jsonb;
    return;
  end if;

  if handoff.expires_at <= now() then
    delete from public.account_session_handoffs where nonce = target_nonce;
    return query select 'expired'::text, null::jsonb;
    return;
  end if;

  if handoff.status = 'ready' then
    update public.account_session_handoffs
      set status = 'consumed'
      where nonce = target_nonce;
    return query select 'ready'::text, handoff.session;
    return;
  end if;

  return query select handoff.status::text, null::jsonb;
end;
$$;

revoke all on function public.consume_account_session_handoff(text) from public, anon, authenticated;
grant execute on function public.consume_account_session_handoff(text) to service_role;

-- Registration already collects profile fields; mark the profile complete so
-- post-login does not trap new users on Account Center setup.
create or replace function public.register_account_center_profile(
  p_username text,
  p_display_name text,
  p_country_code text default null,
  p_preferred_language text default null,
  p_birth_date text default null,
  p_marketing_opt_in boolean default false,
  p_terms_version text default null,
  p_privacy_version text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  normalized text := public.normalize_username(p_username);
  availability jsonb;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  availability := public.check_username_availability(normalized);
  if coalesce((availability->>'available')::boolean, false) is not true then
    raise exception 'USERNAME_UNAVAILABLE';
  end if;
  if p_display_name is null or char_length(btrim(p_display_name)) < 1 or char_length(btrim(p_display_name)) > 64 then
    raise exception 'INVALID_DISPLAY_NAME';
  end if;

  insert into public.profiles(id, username, display_name, country_code, created_at, updated_at,
    profile_completed_at, onboarding_completed, onboarding_completed_at)
  values (
    uid,
    normalized,
    btrim(p_display_name),
    nullif(upper(btrim(coalesce(p_country_code,''))), ''),
    now(),
    now(),
    now(),
    true,
    now()
  )
  on conflict (id) do update
    set username = excluded.username,
        display_name = excluded.display_name,
        country_code = coalesce(excluded.country_code, public.profiles.country_code),
        profile_completed_at = coalesce(public.profiles.profile_completed_at, now()),
        onboarding_completed = true,
        onboarding_completed_at = coalesce(public.profiles.onboarding_completed_at, now()),
        updated_at = now();

  insert into public.profile_details(user_id, preferred_language)
  values (uid, nullif(btrim(coalesce(p_preferred_language,'')), ''))
  on conflict (user_id) do update
    set preferred_language = coalesce(excluded.preferred_language, public.profile_details.preferred_language);

  insert into public.notification_preferences(user_id, marketing_email, product_updates)
  values (uid, coalesce(p_marketing_opt_in, false), coalesce(p_marketing_opt_in, false))
  on conflict (user_id) do nothing;

  insert into public.user_settings(user_id)
  values (uid)
  on conflict (user_id) do nothing;

  insert into public.profile_privacy_settings(user_id)
  values (uid)
  on conflict (user_id) do nothing;

  if p_terms_version is not null then
    insert into public.legal_consents(user_id, document_type, document_version, source)
    values (uid, 'terms', left(p_terms_version, 64), 'registration');
  end if;
  if p_privacy_version is not null then
    insert into public.legal_consents(user_id, document_type, document_version, source)
    values (uid, 'privacy', left(p_privacy_version, 64), 'registration');
  end if;
  insert into public.legal_consents(user_id, document_type, document_version, source)
  values (uid, 'age_gate', 'account-center-1', 'registration');

  if p_marketing_opt_in then
    insert into public.legal_consents(user_id, document_type, document_version, source)
    values (uid, 'marketing', 'account-center-1', 'registration');
  end if;

  insert into public.account_security_events(user_id, event_type, metadata)
  values (uid, 'account_registered', jsonb_build_object('source', 'account_center'));

  return jsonb_build_object('ok', true, 'user_id', uid, 'username', normalized);
end;
$$;

commit;
