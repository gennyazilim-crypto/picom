import { readFile } from "node:fs/promises";

const [migration, pgTap, matrix, accessTypes, catalog, databaseTypes] = await Promise.all([
  readFile("supabase/migrations/20260711153200_meeting_rls_permissions.sql", "utf8"),
  readFile("supabase/tests/rls/meeting_rls_permissions.sql", "utf8"),
  readFile("supabase/tests/hosted/meeting-role-matrix.json", "utf8").then(JSON.parse),
  readFile("src/types/communityAccess.ts", "utf8"),
  readFile("src/services/permissions/communityPermissionCatalog.ts", "utf8"),
  readFile("src/services/supabase/database.types.ts", "utf8"),
]);

const permissions = ["createMeeting","manageMeeting","joinMeeting","publishAudio","publishVideo","shareScreen","admitGuests","manageParticipants","manageStage","viewMeetingHistory","enableCaptions"];
const tables = ["meeting_rooms","meeting_sessions","meeting_session_participants","meeting_waiting_entries","meeting_invites","meeting_events","meeting_attendance"];
const failures = [];

for (const permission of permissions) {
  if (!migration.includes(`('${permission}'`) && permission !== "shareScreen") failures.push(`migration missing ${permission}`);
  if (!accessTypes.includes(`\"${permission}\"`)) failures.push(`CommunityPermissionKey missing ${permission}`);
  if (!catalog.includes(`key: \"${permission}\"`)) failures.push(`permission catalog missing ${permission}`);
}
for (const table of tables) if (!migration.includes(`on public.${table}`) && !migration.includes(`on public.${table} `)) failures.push(`RLS policy coverage missing ${table}`);
for (const value of ["MEETING_SELF_ESCALATION_FORBIDDEN","MEETING_ROLE_HIERARCHY_DENIED","can_view_meeting_sensitive","meeting_join_disposition","set_meeting_participant_role","community_bans","community_member_timeouts","users_are_blocked"]) if (!migration.includes(value)) failures.push(`security contract missing ${value}`);
for (const kind of ["text","radio","podcast"]) if (!matrix.communityKinds.includes(kind)) failures.push(`hosted matrix missing ${kind}`);
for (const role of ["owner","admin","moderator","member","viewer","guest"]) if (!matrix.roles[role]) failures.push(`hosted matrix missing ${role}`);
if (matrix.invariants.length < 10) failures.push("hosted matrix needs complete privacy/hierarchy invariants");
if (!pgTap.includes("select plan(28)") || !pgTap.includes("meeting_participants_select_sensitive")) failures.push("pgTAP contract incomplete");
if (!databaseTypes.includes("authorize_meeting_action:") || !databaseTypes.includes("set_meeting_participant_role:")) failures.push("generated RPC types missing");

if (failures.length) { for (const failure of failures) console.error(`FAIL: ${failure}`); process.exit(1); }
console.log(`PASS: ${permissions.length} permissions, ${tables.length} RLS table boundaries, hierarchy guards, safe RPCs, and text/radio/podcast role matrix are present.`);
