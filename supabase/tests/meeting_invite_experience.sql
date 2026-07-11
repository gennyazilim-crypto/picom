begin;
do $$ begin
  if to_regprocedure('public.regenerate_meeting_invite(uuid,text,text,text,uuid,uuid,timestamp with time zone,integer)') is null then raise exception 'regenerate_meeting_invite missing'; end if;
  if to_regprocedure('public.get_meeting_join_preview(uuid,text)') is null then raise exception 'meeting join preview missing'; end if;
  if has_function_privilege('anon','public.regenerate_meeting_invite(uuid,text,text,text,uuid,uuid,timestamp with time zone,integer)','execute') then raise exception 'anonymous invite regeneration allowed'; end if;
  if has_table_privilege('authenticated','public.meeting_invites','select') then raise exception 'invite hashes directly readable'; end if;
end $$;
rollback;
