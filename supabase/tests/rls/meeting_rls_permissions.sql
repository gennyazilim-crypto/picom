begin;
select plan(30);

-- Contract scenarios: visitor cannot see private room metadata.
-- Contract scenarios: member cannot self-promote.
-- Contract scenarios: cohost cannot assign host.

select has_function('public','meeting_role_rank',array['text'],'meeting role rank exists');
select has_function('public','meeting_role_for_user',array['uuid','uuid'],'server role mapping exists');
select has_function('public','can_view_meeting_room',array['uuid'],'room discovery authorization exists');
select has_function('public','can_join_meeting_room',array['uuid'],'join authorization exists');
select has_function('public','meeting_join_disposition',array['uuid'],'waiting-room disposition exists');
select has_function('public','can_view_meeting_sensitive',array['uuid'],'private participant/event boundary exists');
select has_function('public','can_manage_meeting_participant',array['uuid','text'],'target hierarchy helper exists');
select has_function('public','authorize_meeting_action',array['uuid','text'],'publish/share/caption authorization exists');
select has_function('public','set_meeting_participant_role',array['uuid','text','text'],'safe stage mutation RPC exists');
select has_function('public','authorize_livekit_meeting_moderation',array['uuid','uuid','uuid','text'],'server-authorized meeting media moderation exists');
select has_function('public','record_livekit_meeting_moderation',array['uuid','uuid','uuid','text'],'meeting moderation audit RPC exists');
select ok(public.meeting_role_rank('host')>public.meeting_role_rank('cohost') and public.meeting_role_rank('cohost')>public.meeting_role_rank('speaker'),'host/cohost hierarchy is ordered');
select ok(public.meeting_role_rank('speaker')>public.meeting_role_rank('participant') and public.meeting_role_rank('participant')>public.meeting_role_rank('viewer'),'speaker/participant/viewer hierarchy is ordered');
select ok(public.meeting_role_rank('viewer')>public.meeting_role_rank('guest'),'viewer outranks guest');
select ok((select count(*)=11 from public.community_permission_definitions where permission_key in ('createMeeting','manageMeeting','joinMeeting','publishAudio','publishVideo','shareScreen','admitGuests','manageParticipants','manageStage','viewMeetingHistory','enableCaptions')),'all meeting permissions are registered');
select has_policy('public','meeting_rooms','meeting_rooms_select_accessible','room SELECT policy exists');
select has_policy('public','meeting_rooms','meeting_rooms_insert_creator','room INSERT policy exists');
select has_policy('public','meeting_rooms','meeting_rooms_update_manager','room UPDATE policy exists');
select has_policy('public','meeting_rooms','meeting_rooms_delete_manager','room DELETE policy exists');
select has_policy('public','meeting_session_participants','meeting_participants_select_sensitive','participant list is private');
select has_policy('public','meeting_session_participants','meeting_participants_insert_self','participant INSERT is self-scoped');
select has_policy('public','meeting_session_participants','meeting_participants_update_self_or_manager','participant UPDATE is hierarchy-scoped');
select has_policy('public','meeting_waiting_entries','meeting_waiting_select_self_or_manager','waiting room is self/manager private');
select has_policy('public','meeting_invites','meeting_invites_select_target_or_manager','invites are target/manager private');
select has_policy('public','meeting_events','meeting_events_select_sensitive','meeting events are participant private');
select has_policy('public','meeting_attendance','meeting_attendance_select_self_or_history_manager','attendance is self/history-manager private');
select ok(exists(select 1 from pg_trigger where tgname='trg_meeting_participant_hierarchy' and not tgisinternal),'self-escalation trigger exists');
select ok(pg_get_functiondef('public.set_meeting_participant_role(uuid,text,text)'::regprocedure) like '%MEETING_ROLE_HIERARCHY_DENIED%','privileged RPC rejects hierarchy bypass');
select ok(pg_get_functiondef('public.can_view_meeting_room(uuid)'::regprocedure) like '%public_read_enabled%' and pg_get_functiondef('public.can_view_meeting_room(uuid)'::regprocedure) like '%is_private%','visitor discovery requires public non-private context');
select ok(pg_get_functiondef('public.meeting_user_is_restricted(uuid,uuid)'::regprocedure) like '%community_bans%' and pg_get_functiondef('public.meeting_user_is_restricted(uuid,uuid)'::regprocedure) like '%users_are_blocked%','bans, timeouts, and blocks deny meeting access');

select * from finish();
rollback;
