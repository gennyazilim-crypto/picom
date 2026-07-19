begin;
create or replace function public.manage_meeting_stage_participant(
  target_participant_id uuid,
  stage_action text,
  change_reason text default 'Stage role updated'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  participant_record public.meeting_session_participants%rowtype;
  previous_role text;
  next_role text;
  role_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'MEETING_AUTH_REQUIRED' using errcode = '42501';
  end if;
  if stage_action not in ('promote', 'demote', 'remove') then
    raise exception 'MEETING_STAGE_ACTION_INVALID' using errcode = '22023';
  end if;

  select * into participant_record
  from public.meeting_session_participants
  where id = target_participant_id
    and left_at is null
    and state not in ('left', 'removed')
  for update;
  if not found then
    raise exception 'MEETING_PARTICIPANT_NOT_ACTIVE' using errcode = 'P0002';
  end if;

  previous_role := participant_record.role;
  next_role := case when stage_action = 'promote' then 'speaker' else 'viewer' end;
  role_result := public.set_meeting_participant_role(
    target_participant_id,
    next_role,
    left(coalesce(nullif(trim(change_reason), ''), 'Stage role updated'), 240)
  );

  update public.meeting_participant_runtime_state
  set stage_request_status = case when stage_action = 'promote' then 'approved' else 'denied' end,
      stage_resolved_at = now(),
      stage_resolved_by_user_id = auth.uid(),
      acknowledged_by_user_id = auth.uid(),
      acknowledged_at = now(),
      server_version = server_version + 1,
      updated_by_user_id = auth.uid(),
      updated_at = now()
  where participant_id = target_participant_id;

  return jsonb_build_object(
    'participantId', target_participant_id,
    'previousRole', previous_role,
    'role', next_role,
    'action', stage_action,
    'reauthorizationRequired', participant_record.user_id = auth.uid(),
    'roleResult', role_result
  );
end;
$$;
revoke all on function public.manage_meeting_stage_participant(uuid, text, text) from public, anon;
grant execute on function public.manage_meeting_stage_participant(uuid, text, text) to authenticated;
comment on function public.manage_meeting_stage_participant(uuid, text, text) is
  'Hierarchy-safe stage promotion/demotion wrapper. Canonical role mutation records the audit trail and clients must refresh authorization after their own role changes.';
commit;
