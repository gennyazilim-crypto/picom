-- Hygiene — stale voice presence cleanup. Applied to "piso" (Nexus backend) 2026-07-17.
-- voice_room_participants rows are ephemeral (heartbeat-driven) but were never cleaned up:
-- a row with a 2-week-old heartbeat still showed a user "in voice". Deletes rows whose
-- heartbeat is >5 min old (clients heartbeat every few seconds), every minute via pg_cron.
-- First run removed 1 stale row; live rows (fresh heartbeat) are untouched.
-- Rollback: select cron.unschedule('cleanup-stale-voice-presence');
--           drop function cleanup_stale_voice_presence(integer);
create or replace function public.cleanup_stale_voice_presence(stale_minutes integer default 5)
returns integer language plpgsql security definer set search_path to 'public'
as $function$
declare n integer;
begin
  delete from public.voice_room_participants
  where heartbeat_at < now() - make_interval(mins => greatest(stale_minutes, 1));
  get diagnostics n = row_count;
  return n;
end;
$function$;
revoke all on function public.cleanup_stale_voice_presence(integer) from public;
revoke all on function public.cleanup_stale_voice_presence(integer) from anon;
revoke all on function public.cleanup_stale_voice_presence(integer) from authenticated;
grant execute on function public.cleanup_stale_voice_presence(integer) to service_role;

select cron.unschedule('cleanup-stale-voice-presence')
  where exists (select 1 from cron.job where jobname = 'cleanup-stale-voice-presence');
select cron.schedule('cleanup-stale-voice-presence', '* * * * *',
  $$select public.cleanup_stale_voice_presence(5);$$);
