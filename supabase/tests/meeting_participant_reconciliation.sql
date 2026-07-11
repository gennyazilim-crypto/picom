begin;

do $$
begin
  if to_regclass('public.meeting_participant_runtime_state') is null then raise exception 'runtime state table missing'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='meeting_session_participants' and column_name='last_provider_event_at') then raise exception 'participant provider ordering column missing'; end if;
  if not has_function_privilege('authenticated','public.get_meeting_participant_snapshot(uuid,uuid)','execute') then raise exception 'snapshot RPC is not available to authenticated users'; end if;
  if not has_function_privilege('authenticated','public.set_meeting_participant_hand_state(uuid,boolean)','execute') then raise exception 'hand-state RPC is not available to authenticated users'; end if;
  if has_table_privilege('authenticated','public.meeting_session_participants','update') then raise exception 'client can mutate provider-authoritative participant rows'; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='meeting_participant_runtime_state') then raise exception 'runtime state is not in Realtime publication'; end if;
end $$;

rollback;
