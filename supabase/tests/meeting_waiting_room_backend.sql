-- Task 537 structural waiting-room contract. Apply migrations to a disposable database first.
begin;
do $$ begin
  if to_regprocedure('public.request_meeting_waiting_admission(uuid,uuid,text,text)') is null then raise exception 'request RPC missing'; end if;
  if to_regprocedure('public.resolve_meeting_waiting_entry(uuid,text,text)') is null then raise exception 'resolve RPC missing'; end if;
  if to_regprocedure('public.resolve_all_meeting_waiting(uuid,text,text)') is null then raise exception 'bulk resolve RPC missing'; end if;
  if to_regprocedure('public.cancel_meeting_waiting_request(uuid)') is null then raise exception 'cancel RPC missing'; end if;
  if has_table_privilege('authenticated','public.meeting_waiting_entries','insert') or has_table_privilege('authenticated','public.meeting_waiting_entries','update') or has_table_privilege('authenticated','public.meeting_waiting_entries','delete') then raise exception 'authenticated clients can mutate waiting rows'; end if;
  if not has_function_privilege('authenticated','public.request_meeting_waiting_admission(uuid,uuid,text,text)','execute') then raise exception 'request execute grant missing'; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='meeting_waiting_entries') then raise exception 'waiting Realtime publication missing'; end if;
end $$;
rollback;
