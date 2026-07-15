-- Picom production email operations foundation.
-- SMTP credentials never live in Postgres. The Ubuntu worker receives them from
-- /opt/picom/shared/env/email.production.env and uses service_role for queue RPCs.

create table if not exists public.email_templates (
  id text primary key,
  category text not null check (category in ('required_account_security','support_updates','community_updates','product_announcements','radio_podcast_updates','optional_digest','marketing_advertising','billing')),
  current_version integer not null default 1 check (current_version > 0),
  required_delivery boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id text not null references public.email_templates(id) on delete cascade,
  version integer not null check (version > 0),
  source_checksum text not null,
  locales text[] not null default array['en']::text[],
  status text not null default 'approved' check (status in ('draft','pending_approval','approved','retired')),
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (template_id, version)
);

create table if not exists public.email_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  locale text not null default 'en' check (locale in ('tr','en','de','fr','es','it','pt','ru','ar','ja')),
  required_account_security boolean not null default true check (required_account_security = true),
  support_updates boolean not null default true,
  community_updates boolean not null default false,
  product_announcements boolean not null default false,
  radio_podcast_updates boolean not null default false,
  optional_digest boolean not null default false,
  marketing_advertising boolean not null default false,
  consent_version text,
  consent_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid references public.profiles(id) on delete set null,
  recipient_email text not null check (
    recipient_email = lower(recipient_email)
    and char_length(recipient_email) between 3 and 320
    and recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  recipient_domain text generated always as (lower(split_part(recipient_email, '@', 2))) stored,
  template_id text not null references public.email_templates(id),
  template_version integer not null default 1 check (template_version > 0),
  category text not null check (category in ('required_account_security','support_updates','community_updates','product_announcements','radio_podcast_updates','optional_digest','marketing_advertising','billing')),
  locale text not null default 'en' check (locale in ('tr','en','de','fr','es','it','pt','ru','ar','ja')),
  parameters jsonb not null default '{}'::jsonb check (jsonb_typeof(parameters) = 'object' and octet_length(parameters::text) <= 16384),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  correlation_id text not null check (char_length(correlation_id) between 8 and 120),
  status text not null default 'queued' check (status in ('queued','processing','accepted','retry_scheduled','failed','cancelled')),
  priority smallint not null default 50 check (priority between 0 and 100),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 12),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  accepted_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  provider_message_id text,
  provider_status_category text,
  last_error_code text,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key)
);

create table if not exists public.email_attempts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.email_messages(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  outcome text not null check (outcome in ('accepted','temporary_failure','permanent_failure','cancelled')),
  provider_response_category text,
  provider_message_id text,
  smtp_response_code integer,
  error_code text,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  unique (message_id, attempt_number)
);

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.email_messages(id) on delete cascade,
  event_type text not null check (event_type in ('queued','processing','accepted','retry_scheduled','failed','cancelled','delivered_observed','hard_bounce','soft_bounce','complaint','suppressed')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 4096),
  occurred_at timestamptz not null default now()
);

create table if not exists public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  recipient_email_hash text,
  category text,
  reason text not null check (reason in ('unsubscribe','hard_bounce','complaint','operator','privacy_request')),
  source text not null default 'system',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  lifted_at timestamptz,
  check (user_id is not null or recipient_email_hash is not null)
);

create unique index if not exists email_suppressions_active_unique
  on public.email_suppressions (coalesce(user_id::text, ''), coalesce(recipient_email_hash, ''), coalesce(category, ''))
  where lifted_at is null;

create table if not exists public.email_admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 4096),
  created_at timestamptz not null default now()
);

create table if not exists public.email_rate_limit_buckets (
  bucket_hash text not null,
  scope text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (bucket_hash, scope, window_started_at)
);

create table if not exists public.email_contact_submissions (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  requester_user_id uuid references public.profiles(id) on delete set null,
  requester_email text not null,
  requester_name text,
  subject text not null check (char_length(subject) between 3 and 160),
  body text not null check (char_length(body) between 10 and 5000),
  status text not null default 'received' check (status in ('received','triaged','closed','spam')),
  source text not null check (source in ('desktop_support','web_contact')),
  correlation_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_worker_heartbeats (
  worker_id text primary key,
  status text not null check (status in ('starting','healthy','degraded','stopping')),
  smtp_status text not null check (smtp_status in ('unknown','healthy','unavailable','auth_failed','tls_failed')),
  provider_latency_ms integer,
  last_error_code text,
  processed_count bigint not null default 0,
  failed_count bigint not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists email_messages_claim_idx on public.email_messages (status, next_attempt_at, priority desc, created_at);
create index if not exists email_messages_user_idx on public.email_messages (recipient_user_id, created_at desc);
create index if not exists email_messages_template_idx on public.email_messages (template_id, created_at desc);
create index if not exists email_attempts_message_idx on public.email_attempts (message_id, attempt_number desc);
create index if not exists email_events_message_idx on public.email_events (message_id, occurred_at desc);
create index if not exists email_events_type_idx on public.email_events (event_type, occurred_at desc);
create index if not exists email_contact_status_idx on public.email_contact_submissions (status, created_at desc);
create index if not exists email_admin_actions_created_idx on public.email_admin_actions (created_at desc);

alter table public.email_templates enable row level security;
alter table public.email_template_versions enable row level security;
alter table public.email_preferences enable row level security;
alter table public.email_messages enable row level security;
alter table public.email_attempts enable row level security;
alter table public.email_events enable row level security;
alter table public.email_suppressions enable row level security;
alter table public.email_admin_actions enable row level security;
alter table public.email_rate_limit_buckets enable row level security;
alter table public.email_contact_submissions enable row level security;
alter table public.email_worker_heartbeats enable row level security;

revoke all on public.email_templates, public.email_template_versions, public.email_preferences, public.email_messages,
  public.email_attempts, public.email_events, public.email_suppressions, public.email_admin_actions,
  public.email_rate_limit_buckets, public.email_contact_submissions, public.email_worker_heartbeats
from public, anon, authenticated;

grant select, insert, update on public.email_preferences to authenticated;

drop policy if exists email_preferences_select_own on public.email_preferences;
create policy email_preferences_select_own on public.email_preferences for select to authenticated using (user_id = auth.uid());
drop policy if exists email_preferences_insert_own on public.email_preferences;
create policy email_preferences_insert_own on public.email_preferences for insert to authenticated with check (user_id = auth.uid());
drop policy if exists email_preferences_update_own on public.email_preferences;
create policy email_preferences_update_own on public.email_preferences for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.reject_email_audit_mutation() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception 'EMAIL_AUDIT_IMMUTABLE' using errcode = '42501';
end;
$$;

drop trigger if exists email_admin_actions_immutable on public.email_admin_actions;
create trigger email_admin_actions_immutable before update or delete on public.email_admin_actions
for each row execute function public.reject_email_audit_mutation();

insert into public.email_templates (id, category, required_delivery) values
  ('welcome','required_account_security',true),
  ('support_ticket_received','support_updates',false),
  ('support_internal_contact','support_updates',true),
  ('support_reply','support_updates',false),
  ('support_ticket_closed','support_updates',false),
  ('account_warning','required_account_security',true),
  ('suspension_notice','required_account_security',true),
  ('appeal_received','support_updates',false),
  ('appeal_decision','required_account_security',true),
  ('community_ownership_transfer','community_updates',true),
  ('community_invitation','community_updates',false),
  ('content_removal','required_account_security',true),
  ('temporary_restriction','required_account_security',true),
  ('community_quarantine','community_updates',true),
  ('security_alert','required_account_security',true),
  ('new_login','required_account_security',true),
  ('security_settings_changed','required_account_security',true),
  ('subscription_confirmation','billing',true),
  ('payment_failure','billing',true),
  ('refund_status','billing',true),
  ('incident_status','product_announcements',false),
  ('optional_digest','optional_digest',false),
  ('radio_podcast_update','radio_podcast_updates',false),
  ('product_announcement','product_announcements',false),
  ('marketing_announcement','marketing_advertising',false)
on conflict (id) do update set category = excluded.category, required_delivery = excluded.required_delivery, active = true, updated_at = now();

insert into public.email_template_versions (template_id, version, source_checksum, locales, status, approved_at)
select template.id, 1, 'code-managed-v1', array['tr','en','de','fr','es','it','pt','ru','ar','ja']::text[], 'approved', now()
from public.email_templates template
on conflict (template_id, version) do nothing;

create or replace function public.get_email_preferences() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare result public.email_preferences%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  insert into public.email_preferences (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select * into result from public.email_preferences where user_id = auth.uid();
  return to_jsonb(result) - 'user_id' - 'created_at';
end;
$$;

create or replace function public.update_email_preferences(patch jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare result public.email_preferences%rowtype;
declare requested_locale text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if patch is null or jsonb_typeof(patch) <> 'object' or octet_length(patch::text) > 4096 then
    raise exception 'EMAIL_PREFERENCE_PATCH_INVALID' using errcode = '22023';
  end if;
  requested_locale := coalesce(patch->>'locale', 'en');
  if requested_locale not in ('tr','en','de','fr','es','it','pt','ru','ar','ja') then
    raise exception 'EMAIL_LOCALE_INVALID' using errcode = '22023';
  end if;
  insert into public.email_preferences (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  update public.email_preferences set
    locale = case when patch ? 'locale' then requested_locale else locale end,
    support_updates = case when patch ? 'support_updates' then coalesce((patch->>'support_updates')::boolean, support_updates) else support_updates end,
    community_updates = case when patch ? 'community_updates' then coalesce((patch->>'community_updates')::boolean, community_updates) else community_updates end,
    product_announcements = case when patch ? 'product_announcements' then coalesce((patch->>'product_announcements')::boolean, product_announcements) else product_announcements end,
    radio_podcast_updates = case when patch ? 'radio_podcast_updates' then coalesce((patch->>'radio_podcast_updates')::boolean, radio_podcast_updates) else radio_podcast_updates end,
    optional_digest = case when patch ? 'optional_digest' then coalesce((patch->>'optional_digest')::boolean, optional_digest) else optional_digest end,
    marketing_advertising = case when patch ? 'marketing_advertising' then coalesce((patch->>'marketing_advertising')::boolean, marketing_advertising) else marketing_advertising end,
    consent_version = case when patch ? 'consent_version' then nullif(left(patch->>'consent_version', 80), '') else consent_version end,
    consent_updated_at = now(), updated_at = now()
  where user_id = auth.uid() returning * into result;
  return to_jsonb(result) - 'user_id' - 'created_at';
end;
$$;

create or replace function public.enqueue_email_message(
  p_recipient_email text,
  p_recipient_user_id uuid,
  p_template_id text,
  p_template_version integer,
  p_category text,
  p_locale text,
  p_parameters jsonb,
  p_idempotency_key text,
  p_correlation_id text,
  p_priority smallint default 50
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare normalized_email text := lower(btrim(p_recipient_email));
declare queued_id uuid;
declare template_record public.email_templates%rowtype;
begin
  select * into template_record from public.email_templates where id = p_template_id and active = true;
  if not found then raise exception 'EMAIL_TEMPLATE_NOT_ALLOWED' using errcode = '22023'; end if;
  if p_category <> template_record.category then raise exception 'EMAIL_CATEGORY_MISMATCH' using errcode = '22023'; end if;
  if p_locale not in ('tr','en','de','fr','es','it','pt','ru','ar','ja') then raise exception 'EMAIL_LOCALE_INVALID' using errcode = '22023'; end if;
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or normalized_email ~ E'[\r\n]' then raise exception 'EMAIL_RECIPIENT_INVALID' using errcode = '22023'; end if;
  insert into public.email_messages (recipient_user_id, recipient_email, template_id, template_version, category, locale, parameters, idempotency_key, correlation_id, priority)
  values (p_recipient_user_id, normalized_email, p_template_id, greatest(coalesce(p_template_version,1),1), p_category, p_locale, coalesce(p_parameters,'{}'::jsonb), p_idempotency_key, p_correlation_id, coalesce(p_priority,50))
  on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key
  returning id into queued_id;
  insert into public.email_events(message_id,event_type,metadata) values(queued_id,'queued',jsonb_build_object('source','server'));
  return queued_id;
end;
$$;

create or replace function public.claim_email_messages(p_worker_id text, p_batch_size integer default 10)
returns setof public.email_messages
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return query
  with candidates as (
    select message.id from public.email_messages message
    where message.status in ('queued','retry_scheduled')
      and message.next_attempt_at <= now()
      and message.expires_at > now()
    order by message.priority desc, message.next_attempt_at, message.created_at
    for update skip locked limit least(greatest(coalesce(p_batch_size,10),1),50)
  )
  update public.email_messages message set status='processing', locked_at=now(), locked_by=left(p_worker_id,120), attempt_count=message.attempt_count+1, updated_at=now()
  from candidates where message.id=candidates.id returning message.*;
end;
$$;

create or replace function public.complete_email_attempt(
  p_message_id uuid,
  p_outcome text,
  p_provider_response_category text,
  p_provider_message_id text,
  p_smtp_response_code integer,
  p_error_code text,
  p_latency_ms integer,
  p_started_at timestamptz,
  p_next_attempt_at timestamptz default null
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare message_record public.email_messages%rowtype;
declare next_status text;
begin
  select * into message_record from public.email_messages where id=p_message_id for update;
  if not found then raise exception 'EMAIL_MESSAGE_NOT_FOUND'; end if;
  if p_outcome not in ('accepted','temporary_failure','permanent_failure','cancelled') then raise exception 'EMAIL_OUTCOME_INVALID'; end if;
  insert into public.email_attempts(message_id,attempt_number,outcome,provider_response_category,provider_message_id,smtp_response_code,error_code,latency_ms,started_at)
  values(p_message_id,message_record.attempt_count,p_outcome,left(p_provider_response_category,120),left(p_provider_message_id,255),p_smtp_response_code,left(p_error_code,120),p_latency_ms,p_started_at)
  on conflict(message_id,attempt_number) do nothing;
  next_status := case
    when p_outcome='accepted' then 'accepted'
    when p_outcome='cancelled' then 'cancelled'
    when p_outcome='temporary_failure' and message_record.attempt_count < message_record.max_attempts then 'retry_scheduled'
    else 'failed' end;
  update public.email_messages set status=next_status, provider_status_category=left(p_provider_response_category,120), provider_message_id=left(p_provider_message_id,255), last_error_code=left(p_error_code,120),
    next_attempt_at=case when next_status='retry_scheduled' then coalesce(p_next_attempt_at,now()+interval '5 minutes') else next_attempt_at end,
    accepted_at=case when next_status='accepted' then now() else accepted_at end,
    failed_at=case when next_status='failed' then now() else failed_at end,
    cancelled_at=case when next_status='cancelled' then now() else cancelled_at end,
    locked_at=null, locked_by=null, updated_at=now() where id=p_message_id;
  insert into public.email_events(message_id,event_type,metadata) values(p_message_id,next_status,jsonb_build_object('errorCode',left(coalesce(p_error_code,''),120),'attempt',message_record.attempt_count));
  return true;
end;
$$;

create or replace function public.consume_email_rate_limit(p_bucket_hash text, p_scope text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare window_start timestamptz;
declare next_count integer;
begin
  if char_length(p_bucket_hash) < 32 or p_limit < 1 or p_window_seconds not between 10 and 86400 then raise exception 'EMAIL_RATE_LIMIT_INVALID'; end if;
  window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.email_rate_limit_buckets(bucket_hash,scope,window_started_at,request_count) values(p_bucket_hash,left(p_scope,80),window_start,1)
  on conflict(bucket_hash,scope,window_started_at) do update set request_count=public.email_rate_limit_buckets.request_count+1,updated_at=now()
  returning request_count into next_count;
  return next_count <= p_limit;
end;
$$;

create or replace function public.create_email_contact_submission(p_user_id uuid,p_email text,p_name text,p_subject text,p_body text,p_source text,p_correlation_id text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare created_record public.email_contact_submissions%rowtype;
declare ticket text := 'PIC-' || to_char(clock_timestamp(),'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
begin
  insert into public.email_contact_submissions(ticket_number,requester_user_id,requester_email,requester_name,subject,body,source,correlation_id)
  values(ticket,p_user_id,lower(btrim(p_email)),nullif(left(btrim(p_name),100),''),left(btrim(p_subject),160),left(btrim(p_body),5000),p_source,left(p_correlation_id,120))
  returning * into created_record;
  return jsonb_build_object('id',created_record.id,'ticketNumber',created_record.ticket_number,'createdAt',created_record.created_at);
end;
$$;

create or replace function public.is_email_suppressed(p_user_id uuid,p_email_hash text,p_category text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.email_suppressions suppression where suppression.lifted_at is null and (suppression.expires_at is null or suppression.expires_at>now())
    and (suppression.user_id=p_user_id or suppression.recipient_email_hash=p_email_hash)
    and (suppression.category is null or suppression.category=p_category));
$$;

create or replace function public.suppress_email_recipient(p_user_id uuid,p_email_hash text,p_category text,p_reason text,p_source text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare suppression_id uuid;
begin
  if p_reason not in ('unsubscribe','hard_bounce','complaint','operator','privacy_request') then raise exception 'EMAIL_SUPPRESSION_REASON_INVALID'; end if;
  insert into public.email_suppressions(user_id,recipient_email_hash,category,reason,source)
  values(p_user_id,nullif(p_email_hash,''),nullif(p_category,''),p_reason,left(coalesce(p_source,'system'),80))
  on conflict(coalesce(user_id::text,''),coalesce(recipient_email_hash,''),coalesce(category,'')) where lifted_at is null
  do update set reason=excluded.reason,source=excluded.source,created_at=now(),expires_at=null
  returning id into suppression_id;
  return suppression_id;
end;
$$;

create or replace function public.record_email_worker_heartbeat(p_worker_id text,p_status text,p_smtp_status text,p_latency_ms integer,p_error_code text,p_processed_increment integer default 0,p_failed_increment integer default 0)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.email_worker_heartbeats(worker_id,status,smtp_status,provider_latency_ms,last_error_code,processed_count,failed_count,updated_at)
  values(left(p_worker_id,120),p_status,p_smtp_status,p_latency_ms,left(p_error_code,120),greatest(p_processed_increment,0),greatest(p_failed_increment,0),now())
  on conflict(worker_id) do update set status=excluded.status,smtp_status=excluded.smtp_status,provider_latency_ms=excluded.provider_latency_ms,last_error_code=excluded.last_error_code,
    processed_count=public.email_worker_heartbeats.processed_count+excluded.processed_count,failed_count=public.email_worker_heartbeats.failed_count+excluded.failed_count,updated_at=now();
  return true;
end;
$$;

create or replace function public.get_email_operations_summary() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_app_admin() then raise exception 'APP_ADMIN_REQUIRED' using errcode='42501'; end if;
  return jsonb_build_object(
    'queued',(select count(*) from public.email_messages where status='queued'),
    'processing',(select count(*) from public.email_messages where status='processing'),
    'accepted',(select count(*) from public.email_messages where status='accepted' and created_at>=now()-interval '24 hours'),
    'retryBacklog',(select count(*) from public.email_messages where status='retry_scheduled'),
    'failed24h',(select count(*) from public.email_messages where status='failed' and failed_at>=now()-interval '24 hours'),
    'suppressionCount',(select count(*) from public.email_suppressions where lifted_at is null),
    'hourlyVolume',(select count(*) from public.email_messages where created_at>=now()-interval '1 hour'),
    'worker',(select coalesce(jsonb_agg(jsonb_build_object('id',worker_id,'status',status,'smtpStatus',smtp_status,'latencyMs',provider_latency_ms,'updatedAt',updated_at)),'[]'::jsonb) from public.email_worker_heartbeats),
    'checkedAt',now()
  );
end;
$$;

create or replace function public.list_email_operations(p_limit integer default 50)
returns table(id uuid,template_id text,status text,recipient_domain text,attempt_count integer,created_at timestamptz,last_error_code text,correlation_id text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_app_admin() then raise exception 'APP_ADMIN_REQUIRED' using errcode='42501'; end if;
  return query select message.id,message.template_id,message.status,message.recipient_domain,message.attempt_count,message.created_at,message.last_error_code,message.correlation_id
    from public.email_messages message order by message.created_at desc limit least(greatest(coalesce(p_limit,50),1),100);
end;
$$;

create or replace function public.admin_retry_email(p_message_id uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_app_admin() then raise exception 'APP_ADMIN_REQUIRED' using errcode='42501'; end if;
  update public.email_messages set status='queued',next_attempt_at=now(),locked_at=null,locked_by=null,updated_at=now() where id=p_message_id and status in ('failed','retry_scheduled');
  if not found then return false; end if;
  insert into public.email_admin_actions(actor_id,action,target_type,target_id) values(auth.uid(),'retry','email_message',p_message_id::text);
  return true;
end;
$$;

create or replace function public.admin_cancel_email(p_message_id uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_app_admin() then raise exception 'APP_ADMIN_REQUIRED' using errcode='42501'; end if;
  update public.email_messages set status='cancelled',cancelled_at=now(),updated_at=now() where id=p_message_id and status in ('queued','retry_scheduled');
  if not found then return false; end if;
  insert into public.email_admin_actions(actor_id,action,target_type,target_id) values(auth.uid(),'cancel','email_message',p_message_id::text);
  return true;
end;
$$;

create or replace function public.cleanup_email_operational_data() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare attempts_deleted integer; declare events_deleted integer; declare messages_deleted integer; declare limits_deleted integer;
begin
  delete from public.email_attempts where completed_at < now()-interval '180 days'; get diagnostics attempts_deleted=row_count;
  delete from public.email_events where occurred_at < now()-interval '180 days'; get diagnostics events_deleted=row_count;
  delete from public.email_messages where created_at < now()-interval '180 days' and status in ('accepted','failed','cancelled'); get diagnostics messages_deleted=row_count;
  delete from public.email_rate_limit_buckets where window_started_at < now()-interval '2 days'; get diagnostics limits_deleted=row_count;
  return jsonb_build_object('attempts',attempts_deleted,'events',events_deleted,'messages',messages_deleted,'rateLimits',limits_deleted);
end;
$$;

revoke all on function public.get_email_preferences(), public.update_email_preferences(jsonb) from public, anon;
grant execute on function public.get_email_preferences(), public.update_email_preferences(jsonb) to authenticated;

revoke all on function public.enqueue_email_message(text,uuid,text,integer,text,text,jsonb,text,text,smallint),
  public.claim_email_messages(text,integer), public.complete_email_attempt(uuid,text,text,text,integer,text,integer,timestamptz,timestamptz),
  public.consume_email_rate_limit(text,text,integer,integer), public.create_email_contact_submission(uuid,text,text,text,text,text,text),
  public.is_email_suppressed(uuid,text,text), public.suppress_email_recipient(uuid,text,text,text,text),
  public.record_email_worker_heartbeat(text,text,text,integer,text,integer,integer), public.cleanup_email_operational_data()
from public, anon, authenticated;
grant execute on function public.enqueue_email_message(text,uuid,text,integer,text,text,jsonb,text,text,smallint),
  public.claim_email_messages(text,integer), public.complete_email_attempt(uuid,text,text,text,integer,text,integer,timestamptz,timestamptz),
  public.consume_email_rate_limit(text,text,integer,integer), public.create_email_contact_submission(uuid,text,text,text,text,text,text),
  public.is_email_suppressed(uuid,text,text), public.suppress_email_recipient(uuid,text,text,text,text),
  public.record_email_worker_heartbeat(text,text,text,integer,text,integer,integer), public.cleanup_email_operational_data()
to service_role;

revoke all on function public.get_email_operations_summary(), public.list_email_operations(integer), public.admin_retry_email(uuid), public.admin_cancel_email(uuid) from public, anon;
grant execute on function public.get_email_operations_summary(), public.list_email_operations(integer), public.admin_retry_email(uuid), public.admin_cancel_email(uuid) to authenticated;

