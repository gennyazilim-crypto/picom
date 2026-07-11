-- Task 536 structural webhook contract. Apply all migrations to a disposable database first.
begin;
do $$ begin
  if to_regclass('public.livekit_webhook_receipts') is null then raise exception 'webhook receipt table missing'; end if;
  if to_regclass('public.meeting_participant_tracks') is null then raise exception 'meeting track table missing'; end if;
  if to_regprocedure('public.process_livekit_webhook_event(text,text,timestamp with time zone,uuid,uuid,text,text,text,text,text,text,text)') is null then raise exception 'webhook reconciliation RPC missing'; end if;
  if has_function_privilege('authenticated','public.process_livekit_webhook_event(text,text,timestamp with time zone,uuid,uuid,text,text,text,text,text,text,text)','execute') then raise exception 'authenticated users can execute provider reconciliation'; end if;
  if not has_function_privilege('service_role','public.process_livekit_webhook_event(text,text,timestamp with time zone,uuid,uuid,text,text,text,text,text,text,text)','execute') then raise exception 'service role execute grant missing'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='livekit_webhook_receipts' and column_name in ('raw_body','payload','authorization_header','secret','token')) then raise exception 'raw webhook data column found'; end if;
end $$;
rollback;
