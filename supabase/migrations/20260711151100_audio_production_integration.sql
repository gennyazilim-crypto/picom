create or replace function public.enforce_radio_community_kind()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.community_has_kind(new.community_id, 'radio'::public.community_kind) then
    raise exception 'RADIO_COMMUNITY_KIND_REQUIRED' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists radio_settings_kind_guard on public.radio_community_settings;
create trigger radio_settings_kind_guard before insert or update of community_id on public.radio_community_settings
for each row execute function public.enforce_radio_community_kind();

drop trigger if exists radio_program_kind_guard on public.radio_programs;
create trigger radio_program_kind_guard before insert or update of community_id on public.radio_programs
for each row execute function public.enforce_radio_community_kind();

drop trigger if exists radio_session_kind_guard on public.radio_sessions;
create trigger radio_session_kind_guard before insert or update of community_id on public.radio_sessions
for each row execute function public.enforce_radio_community_kind();

drop trigger if exists radio_schedule_kind_guard on public.radio_program_schedules;
create trigger radio_schedule_kind_guard before insert or update of community_id on public.radio_program_schedules
for each row execute function public.enforce_radio_community_kind();

drop trigger if exists radio_announcement_kind_guard on public.radio_announcements;
create trigger radio_announcement_kind_guard before insert or update of community_id on public.radio_announcements
for each row execute function public.enforce_radio_community_kind();

revoke all on function public.enforce_radio_community_kind() from public, anon, authenticated;

comment on function public.enforce_radio_community_kind() is
  'Table-level invariant that prevents Radio metadata from being attached to Text or Podcast communities, including privileged migration/service writes.';;
