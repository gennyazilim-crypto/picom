-- Apply migrations to a disposable database before this Task 563 structural contract.
begin;
do $$ begin
  if to_regclass('public.meeting_screen_share_leases') is null then raise exception 'screen-share lease table missing'; end if;
  if to_regprocedure('public.claim_meeting_screen_share(uuid,uuid,integer)') is null then raise exception 'screen-share claim RPC missing'; end if;
  if to_regprocedure('public.release_meeting_screen_share(uuid,uuid)') is null then raise exception 'screen-share release RPC missing'; end if;
  if has_table_privilege('authenticated','public.meeting_screen_share_leases','insert') or has_table_privilege('authenticated','public.meeting_screen_share_leases','update') or has_table_privilege('authenticated','public.meeting_screen_share_leases','delete') then raise exception 'authenticated clients can bypass lease RPCs'; end if;
  if not has_function_privilege('authenticated','public.claim_meeting_screen_share(uuid,uuid,integer)','execute') then raise exception 'claim execute grant missing'; end if;
  if not has_function_privilege('authenticated','public.release_meeting_screen_share(uuid,uuid)','execute') then raise exception 'release execute grant missing'; end if;
end $$;
rollback;
