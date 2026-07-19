-- Task 173: app-admin-only aggregate Trust & Safety summary.

create table if not exists public.abuse_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('repeated_failed_login','rate_limit_exceeded','upload_rejected','webhook_rate_limit','invite_abuse','blocked_words_hit','suspicious_attachment','unauthorized_private_channel_access','invalid_deep_link')),
  severity text not null check (severity in ('info','warning','critical')),
  community_id uuid references public.communities(id) on delete set null,
  reason_code text not null check (char_length(reason_code) between 1 and 80),
  created_at timestamptz not null default now()
);
create index if not exists idx_abuse_events_created_type on public.abuse_events(created_at desc, event_type);
alter table public.abuse_events enable row level security;
revoke all on public.abuse_events from anon, authenticated;
comment on table public.abuse_events is 'Backend-only content-free abuse signals. Never store message content, raw IPs, credentials, headers, signed URLs, or private metadata.';
create or replace function public.get_trust_safety_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if not public.is_app_admin() then raise exception 'APP_ADMIN_REQUIRED'; end if;

  select jsonb_build_object(
    'openReports', (select count(*) from public.reports where status = 'open'),
    'suspiciousUploads', (select count(*) from public.attachments where scan_status in ('suspicious','failed')),
    'pendingUploadReviews', (select count(*) from public.attachments where scan_status = 'pending'),
    'abuseEvents', (select count(*) from public.abuse_events where created_at >= now() - interval '24 hours'),
    'criticalAbuseEvents', (select count(*) from public.abuse_events where severity = 'critical' and created_at >= now() - interval '24 hours'),
    'rateLimitEvents', (select coalesce(sum(denied_count), 0) from public.user_action_rate_limits where last_denied_at >= now() - interval '24 hours'),
    'recentBans', (select count(*) from public.community_bans where created_at >= now() - interval '24 hours' and revoked_at is null),
    'recentKicks', (select count(*) from public.moderation_action_records where action_type = 'kick' and created_at >= now() - interval '24 hours'),
    'windowHours', 24,
    'checkedAt', now()
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_trust_safety_summary() from public, anon;
grant execute on function public.get_trust_safety_summary() to authenticated;
comment on function public.get_trust_safety_summary() is 'App-admin-only aggregate safety counts. Returns no IDs, content, paths, reasons, credentials, IP data, or private message context.';
