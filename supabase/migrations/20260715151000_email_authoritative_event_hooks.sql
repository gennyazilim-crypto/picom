-- Queue security and moderation email only after authoritative database changes.
-- Delivery failures must not roll back account or moderation state, so hook
-- failures are recorded without storing recipient addresses or message content.

create table if not exists public.email_hook_failures (
  id uuid primary key default gen_random_uuid(),
  hook_name text not null check (char_length(hook_name) between 3 and 80),
  source_record_id text not null check (char_length(source_record_id) between 1 and 200),
  recipient_user_id uuid references public.profiles(id) on delete set null,
  error_code text not null check (char_length(error_code) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (hook_name, source_record_id, recipient_user_id)
);

alter table public.email_hook_failures enable row level security;
revoke all on public.email_hook_failures from public, anon, authenticated;
grant select, insert, update on public.email_hook_failures to service_role;

create or replace function public.resolve_email_recipient(target_user_id uuid)
returns table(recipient_email text, recipient_locale text, recipient_display_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    lower(auth_user.email),
    coalesce(preference.locale, 'en'),
    coalesce(nullif(profile.display_name, ''), nullif(profile.username, ''), 'Picom member')
  from auth.users auth_user
  join public.profiles profile on profile.id = auth_user.id
  left join public.email_preferences preference on preference.user_id = auth_user.id
  where auth_user.id = target_user_id
    and auth_user.email is not null
    and auth_user.email <> ''
  limit 1
$$;

create or replace function public.enqueue_email_for_user_event(
  target_user_id uuid,
  target_template_id text,
  target_category text,
  target_parameters jsonb,
  target_idempotency_key text,
  target_correlation_id text,
  target_priority smallint,
  target_hook_name text,
  target_source_record_id text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recipient record;
  queued_id uuid;
  failure_state text;
begin
  select * into recipient from public.resolve_email_recipient(target_user_id);
  if recipient.recipient_email is null then
    insert into public.email_hook_failures(hook_name, source_record_id, recipient_user_id, error_code)
    values (target_hook_name, target_source_record_id, target_user_id, 'RECIPIENT_UNAVAILABLE')
    on conflict (hook_name, source_record_id, recipient_user_id)
    do update set error_code = excluded.error_code, created_at = now();
    return null;
  end if;

  queued_id := public.enqueue_email_message(
    recipient.recipient_email,
    target_user_id,
    target_template_id,
    1,
    target_category,
    recipient.recipient_locale,
    coalesce(target_parameters, '{}'::jsonb)
      || jsonb_build_object('displayName', recipient.recipient_display_name),
    target_idempotency_key,
    target_correlation_id,
    target_priority
  );
  return queued_id;
exception when others then
  get stacked diagnostics failure_state = returned_sqlstate;
  insert into public.email_hook_failures(hook_name, source_record_id, recipient_user_id, error_code)
  values (target_hook_name, target_source_record_id, target_user_id, coalesce(failure_state, 'HOOK_FAILED'))
  on conflict (hook_name, source_record_id, recipient_user_id)
  do update set error_code = excluded.error_code, created_at = now();
  return null;
end;
$$;

create or replace function public.queue_account_security_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  event_summary text;
begin
  event_summary := case new.event_type
    when 'account_deletion_requested' then 'An account deletion request was created. Review account security if you did not request this.'
    when 'account_deletion_canceled' then 'Your account deletion request was canceled.'
    when 'account_sessions_revoked' then 'All other Picom sessions were revoked for your protection.'
    else null
  end;
  if event_summary is null then return new; end if;

  perform public.enqueue_email_for_user_event(
    new.user_id,
    case when new.event_type = 'account_sessions_revoked' then 'security_alert' else 'security_settings_changed' end,
    'required_account_security',
    jsonb_build_object(
      'summary', event_summary,
      'reference', new.event_type,
      'actionUrl', 'https://picom.gg/account/security',
      'actionLabel', 'Review account security'
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

drop trigger if exists account_security_events_email_hook on public.account_security_events;
create trigger account_security_events_email_hook
after insert on public.account_security_events
for each row execute function public.queue_account_security_email();

create or replace function public.queue_moderation_action_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  community_name text;
  template_id text;
  event_summary text;
begin
  select community.name into community_name
  from public.communities community where community.id = new.community_id;

  template_id := case new.action_type
    when 'ban' then 'suspension_notice'
    when 'timeout' then 'temporary_restriction'
    when 'kick' then 'temporary_restriction'
    when 'message_delete' then 'content_removal'
    else 'account_warning'
  end;
  event_summary := case new.action_type
    when 'ban' then 'Your access to a Picom community was suspended by an authorized moderator.'
    when 'timeout' then 'A temporary participation restriction was applied by an authorized moderator.'
    when 'kick' then 'Your community membership was ended by an authorized moderator.'
    when 'message_delete' then 'Content you posted was removed by an authorized moderator.'
    else 'An authorized moderation action was applied to your account.'
  end;

  perform public.enqueue_email_for_user_event(
    new.affected_user_id,
    template_id,
    'required_account_security',
    jsonb_build_object(
      'summary', event_summary,
      'reference', coalesce(community_name, 'Picom community'),
      'actionUrl', 'https://picom.gg/safety',
      'actionLabel', 'Review safety information'
    ),
    'moderation-action:' || new.id::text,
    'moderation-action:' || new.id::text,
    90::smallint,
    'moderation_action_records',
    new.id::text
  );
  return new;
end;
$$;

drop trigger if exists moderation_action_records_email_hook on public.moderation_action_records;
create trigger moderation_action_records_email_hook
after insert on public.moderation_action_records
for each row execute function public.queue_moderation_action_email();

create or replace function public.queue_moderation_appeal_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  community_name text;
  final_status text;
begin
  select community.name into community_name
  from public.communities community where community.id = new.community_id;

  if tg_op = 'INSERT' then
    perform public.enqueue_email_for_user_event(
      new.affected_user_id,
      'appeal_received',
      'support_updates',
      jsonb_build_object(
        'summary', 'Your moderation appeal was received and is available to authorized reviewers.',
        'reference', coalesce(community_name, 'Picom community')
      ),
      'moderation-appeal-received:' || new.id::text,
      'moderation-appeal:' || new.id::text,
      70::smallint,
      'moderation_appeals',
      new.id::text || ':received'
    );
    return new;
  end if;

  final_status := case when new.status in ('accepted', 'denied', 'closed') then new.status else null end;
  if new.status is not distinct from old.status or final_status is null then return new; end if;
  perform public.enqueue_email_for_user_event(
    new.affected_user_id,
    'appeal_decision',
    'required_account_security',
    jsonb_build_object(
      'summary', 'A decision was recorded for your moderation appeal: ' || final_status || '.',
      'reference', coalesce(community_name, 'Picom community'),
      'actionUrl', 'https://picom.gg/safety',
      'actionLabel', 'Review appeal status'
    ),
    'moderation-appeal-decision:' || new.id::text || ':' || final_status,
    'moderation-appeal:' || new.id::text,
    90::smallint,
    'moderation_appeals',
    new.id::text || ':' || final_status
  );
  return new;
end;
$$;

drop trigger if exists moderation_appeals_email_insert_hook on public.moderation_appeals;
create trigger moderation_appeals_email_insert_hook
after insert on public.moderation_appeals
for each row execute function public.queue_moderation_appeal_email();

drop trigger if exists moderation_appeals_email_update_hook on public.moderation_appeals;
create trigger moderation_appeals_email_update_hook
after update of status on public.moderation_appeals
for each row execute function public.queue_moderation_appeal_email();

create or replace function public.queue_community_ownership_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.owner_id is not distinct from old.owner_id then return new; end if;

  perform public.enqueue_email_for_user_event(
    old.owner_id,
    'community_ownership_transfer',
    'community_updates',
    jsonb_build_object('summary', 'Community ownership was transferred from your account.', 'reference', new.name),
    'community-owner-transfer:' || new.id::text || ':former:' || old.owner_id::text,
    'community-owner-transfer:' || new.id::text,
    85::smallint,
    'communities',
    new.id::text || ':former:' || old.owner_id::text
  );
  perform public.enqueue_email_for_user_event(
    new.owner_id,
    'community_ownership_transfer',
    'community_updates',
    jsonb_build_object('summary', 'Community ownership was transferred to your account.', 'reference', new.name),
    'community-owner-transfer:' || new.id::text || ':new:' || new.owner_id::text,
    'community-owner-transfer:' || new.id::text,
    85::smallint,
    'communities',
    new.id::text || ':new:' || new.owner_id::text
  );
  return new;
end;
$$;

drop trigger if exists communities_ownership_email_hook on public.communities;
create trigger communities_ownership_email_hook
after update of owner_id on public.communities
for each row execute function public.queue_community_ownership_email();

revoke all on function public.resolve_email_recipient(uuid),
  public.enqueue_email_for_user_event(uuid,text,text,jsonb,text,text,smallint,text,text),
  public.queue_account_security_email(), public.queue_moderation_action_email(),
  public.queue_moderation_appeal_email(), public.queue_community_ownership_email()
from public, anon, authenticated;
grant execute on function public.resolve_email_recipient(uuid),
  public.enqueue_email_for_user_event(uuid,text,text,jsonb,text,text,smallint,text,text)
to service_role;

comment on table public.email_hook_failures is
  'Metadata-only failures from authoritative email hooks. Never stores recipient addresses, credentials, or message content.';
