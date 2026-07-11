# Meeting RLS and Permission Matrix

## Server authority

Meeting access is authorized by Supabase RLS and security-definer functions. Renderer capability checks are presentation only. LiveKit token grants in Task 535 must call `authorize_meeting_action` or an equivalent server-authoritative projection.

## Permission catalog

The canonical meeting permissions are `createMeeting`, `manageMeeting`, `joinMeeting`, `publishAudio`, `publishVideo`, `shareScreen`, `admitGuests`, `manageParticipants`, `manageStage`, `viewMeetingHistory`, and `enableCaptions`.

Owner maps to host, Admin to cohost, Moderator to speaker, Member to the room default participant/viewer role, and an invited non-member to the explicit invite role. Custom roles use the existing normalized community permission registry and scoped overrides.

## Privacy

- Anonymous users cannot discover meeting rooms.
- An authenticated visitor may see only an open public room whose source channel is non-private.
- Public room visibility never exposes participant lists, invitations, waiting entries, event/caption data, or attendance.
- Active members and admitted participants may see sensitive session state according to RLS.
- Invite targets see only their own invite; waiting users see only their own waiting entry.
- Attendance is visible only to its user or a role with `viewMeetingHistory`.
- Bans, active timeouts and user blocks deny discovery/join/publish.

## Join and waiting room

`can_join_meeting_room` requires an open/live room plus active membership permission, an active invite, or a public-open policy. `meeting_join_disposition` returns `direct`, `waiting`, or `denied`; a client cannot choose its own admission result.

## Hierarchy

`trg_meeting_participant_hierarchy` and `set_meeting_participant_role` prevent self-escalation. An actor must outrank both the current and proposed target role. Cohost cannot assign host, moderator cannot manage equal/higher roles, and host ownership remains community-owner authority.

## Matrix evidence

`supabase/tests/hosted/meeting-role-matrix.json` covers Owner/Admin/Moderator/Member/Viewer/Guest across Text, Radio and Podcast communities. `supabase/tests/rls/meeting_rls_permissions.sql` verifies registry, functions, policies, trigger and hierarchy contracts.

Local structural PASS is not hosted proof. The protected staging matrix must still execute with synthetic actors and verify negative reads/mutations before production readiness.
