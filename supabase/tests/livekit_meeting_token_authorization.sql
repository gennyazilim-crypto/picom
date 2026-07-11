-- Task 535 structural contract. Apply migrations in a disposable database first.
begin;
do $$ begin
  if to_regprocedure('public.meeting_livekit_room_name(uuid,uuid)') is null then raise exception 'meeting room naming function missing'; end if;
  if to_regprocedure('public.authorize_livekit_meeting_token(uuid,uuid,boolean,boolean,boolean,boolean)') is null then raise exception 'meeting token authorization function missing'; end if;
  if not has_function_privilege('authenticated','public.authorize_livekit_meeting_token(uuid,uuid,boolean,boolean,boolean,boolean)','execute') then raise exception 'authenticated execute grant missing'; end if;
  if has_function_privilege('anon','public.authorize_livekit_meeting_token(uuid,uuid,boolean,boolean,boolean,boolean)','execute') then raise exception 'anonymous execute must be denied'; end if;
end $$;
rollback;
