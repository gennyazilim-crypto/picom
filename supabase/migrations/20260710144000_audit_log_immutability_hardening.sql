-- Task 144: explicit append-only enforcement and bounded redaction.

revoke insert, update, delete, truncate on table public.audit_log from public, anon, authenticated;
alter table public.audit_log drop constraint if exists audit_log_target_type_length;
alter table public.audit_log add constraint audit_log_target_type_length
  check (char_length(target_type) between 1 and 80 and target_type ~ '^[a-zA-Z0-9_:-]+$');
create or replace function public.redact_audit_reason(input_text text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare cleaned text;
begin
  if input_text is null then return null; end if;
  cleaned := regexp_replace(input_text, '[[:cntrl:]]+', ' ', 'g');
  cleaned := regexp_replace(cleaned, '(?i)(bearer)[[:space:]]+[a-z0-9._~+/-]+', '\1 [REDACTED]', 'g');
  cleaned := regexp_replace(cleaned, '(?i)(password|token|secret|authorization|cookie|api[_-]?key)[[:space:]]*[:=][[:space:]]*[^,;[:space:]]+', '\1=[REDACTED]', 'g');
  return nullif(left(btrim(cleaned), 500), '');
end;
$$;
revoke all on function public.redact_audit_reason(text) from public, anon, authenticated;
create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'AUDIT_LOG_APPEND_ONLY' using errcode = 'P0001';
end;
$$;
revoke all on function public.prevent_audit_log_mutation() from public, anon, authenticated;
drop trigger if exists audit_log_append_only on public.audit_log;
create trigger audit_log_append_only
before update or delete on public.audit_log
for each row execute function public.prevent_audit_log_mutation();
create or replace function public.append_community_audit_log(
  target_community_id uuid,
  event_action_type text,
  event_target_type text,
  event_target_id uuid default null,
  event_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if event_target_type is null or event_target_type !~ '^[a-zA-Z0-9_:-]{1,80}$' then raise exception 'AUDIT_TARGET_TYPE_INVALID'; end if;
  if not (public.can_view_community_audit_log(target_community_id) or public.can_moderate_community_reports(target_community_id) or public.can_create_community_invite(target_community_id)) then raise exception 'permission denied'; end if;
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason)
  values(target_community_id,auth.uid(),event_action_type,event_target_type,event_target_id,public.redact_audit_reason(event_reason))
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.append_community_audit_log(uuid,text,text,uuid,text) from public, anon;
grant execute on function public.append_community_audit_log(uuid,text,text,uuid,text) to authenticated;
comment on table public.audit_log is
  'Append-only community audit facts. Corrections are new entries; normal update/delete/truncate is prohibited.';
