-- Task 534 structural database contract. Run after applying all migrations to a disposable database.
begin;
do $$
begin
  if to_regclass('public.meeting_invite_redemptions') is null then raise exception 'meeting_invite_redemptions missing'; end if;
  if to_regprocedure('public.schedule_meeting_room(uuid,timestamp with time zone,timestamp with time zone,uuid,uuid[],uuid,jsonb)') is null then raise exception 'schedule_meeting_room missing'; end if;
  if to_regprocedure('public.create_meeting_invite(uuid,text,text,text,uuid,uuid,timestamp with time zone,integer)') is null then raise exception 'create_meeting_invite missing'; end if;
  if to_regprocedure('public.revoke_meeting_invite(uuid)') is null then raise exception 'revoke_meeting_invite missing'; end if;
  if to_regprocedure('public.validate_meeting_invite(text,uuid,boolean)') is null then raise exception 'validate_meeting_invite missing'; end if;
  if to_regprocedure('public.get_meeting_join_preview(uuid,text)') is null then raise exception 'get_meeting_join_preview missing'; end if;
  if has_table_privilege('authenticated','public.meeting_invites','select') then raise exception 'meeting invite hashes are directly readable'; end if;
  if has_table_privilege('authenticated','public.meeting_invite_redemptions','select') then raise exception 'meeting invite redemptions are directly readable'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='meeting_invites' and column_name in ('token','secret','invite_secret','raw_token')) then raise exception 'plain invite secret column found'; end if;
end;
$$;
rollback;
