-- Forward-only read adapter for the channel UI, backed by the canonical publisher schedule.
-- Mirrors list_upcoming_publisher_schedules visibility gates; filters the owner BEFORE limit.
-- No historical migrations or existing schedule data are changed.
-- Rollback: a forward migration may revoke/drop this new RPC after its caller is removed.
begin;
create or replace function public.list_visible_broadcaster_live_schedule(
  target_broadcaster_id uuid,
  target_limit integer default 20
)
returns table (
  id uuid, title text, description text, category text,
  starts_at timestamptz, ends_at timestamptz, timezone text,
  status text, visibility text, community_id uuid, channel_id uuid,
  reminder_set boolean
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  return query
  select sch.id, sch.title, sch.description, sch.category,
    sch.scheduled_start_at, sch.scheduled_end_at, sch.timezone,
    sch.status, sch.visibility, sch.community_id, sch.channel_id,
    exists (
      select 1 from public.publisher_stream_schedule_reminders reminder
      where reminder.schedule_id = sch.id and reminder.user_id = actor_id and reminder.enabled
    )
  from public.publisher_stream_schedules sch
  where sch.owner_user_id = target_broadcaster_id
    and (
      sch.owner_user_id = actor_id
      or (
        sch.visibility = 'public' and sch.status in ('scheduled', 'ready')
        and sch.scheduled_start_at >= now()
        and public.publisher_profile_is_active_account(sch.owner_user_id)
        and not public.user_has_active_publisher_live_ban(sch.owner_user_id)
        and not public.users_are_blocked(actor_id, sch.owner_user_id)
        and exists (
          select 1 from public.publisher_profiles pp
          where pp.user_id = sch.owner_user_id and pp.status = 'active'
        )
        and exists (
          select 1 from public.publisher_badges badge
          where badge.user_id = sch.owner_user_id and badge.status = 'active'
            and badge.badge_type in ('creator', 'publisher', 'verified_creator', 'verified_publisher')
            and (badge.expires_at is null or badge.expires_at > now())
        )
      )
    )
  order by sch.scheduled_start_at asc, sch.id asc
  limit greatest(1, least(coalesce(target_limit, 20), 100));
end;
$$;
revoke all on function public.list_visible_broadcaster_live_schedule(uuid, integer) from public, anon;
grant execute on function public.list_visible_broadcaster_live_schedule(uuid, integer) to authenticated;
notify pgrst, 'reload schema';
commit;
