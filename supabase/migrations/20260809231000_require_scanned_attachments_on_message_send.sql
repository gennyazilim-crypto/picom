-- Fail closed even for clients that bypass the normal composer flow.
create or replace function public.require_scanned_message_attachment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.message_id is not null
    and new.status = 'attached'
    and new.scan_status not in ('clean', 'skipped_development') then
    raise exception 'MESSAGE_ATTACHMENT_SCAN_REQUIRED' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists require_scanned_message_attachment on public.attachments;
create trigger require_scanned_message_attachment
before insert or update of message_id, status, scan_status on public.attachments
for each row execute function public.require_scanned_message_attachment();
