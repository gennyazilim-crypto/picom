begin;
do $$ begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='meeting_participant_runtime_state' and column_name='stage_request_status') then raise exception 'stage request state missing';end if;
  if not has_function_privilege('authenticated','public.update_meeting_hand_signal(uuid,text)','execute') then raise exception 'hand signal RPC unavailable';end if;
  if not has_function_privilege('authenticated','public.get_meeting_hand_queue(uuid,uuid)','execute') then raise exception 'hand queue RPC unavailable';end if;
  if has_function_privilege('authenticated','public.set_meeting_participant_hand_state(uuid,boolean)','execute') then raise exception 'legacy hand RPC bypass remains available';end if;
  if not exists(select 1 from pg_trigger where tgname='close_meeting_signal_on_participant_exit' and not tgisinternal) then raise exception 'participant-exit signal cleanup missing';end if;
end $$;
rollback;
