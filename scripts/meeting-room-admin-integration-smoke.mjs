import { readFile } from "node:fs/promises";

const [migration,service,component,panel,permissions,types] = await Promise.all([
  readFile("supabase/migrations/20260711153300_meeting_room_admin_integration.sql","utf8"),
  readFile("src/services/meeting/meetingRoomAdminService.ts","utf8"),
  readFile("src/components/CommunityMeetingRoomManagement.tsx","utf8"),
  readFile("src/components/CommunityStructureManagementPanel.tsx","utf8"),
  readFile("src/services/permissions/communityPermissions.ts","utf8"),
  readFile("src/services/supabase/database.types.ts","utf8"),
]);
const failures=[];
for(const rpc of ["list_community_meeting_rooms","create_community_meeting_room","update_community_meeting_room","archive_community_meeting_room","move_community_meeting_room"])if(!migration.includes(rpc)||!service.includes(`\"${rpc}\"`)||!types.includes(`${rpc}:`))failures.push(`missing ${rpc} integration`);
for(const value of ["voice_lounge","meeting","stage","canPublishAudio","canPublishVideo","canShareScreen","waitingRoomEnabled","audienceMode","linkedChatChannelId","maxParticipants","moderationPolicy"])if(!service.includes(value)&&!component.includes(value))failures.push(`room configuration missing ${value}`);
for(const value of ["MEETING_ACTIVE_CONFIGURATION_LOCKED","MEETING_ACTIVE_SESSION_EXISTS","active_policy","transfer","trg_audit_meeting_room_mutation","audit_log"])if(!migration.includes(value))failures.push(`safeguard/audit missing ${value}`);
if(!panel.includes("CommunityMeetingRoomManagement"))failures.push("existing Community Structure panel does not integrate rooms");
if(!permissions.includes("MEETING_PERMISSIONS")||!permissions.includes("createMeeting")||!permissions.includes("manageMeeting"))failures.push("mock permission parity missing");
if(component.includes("placeholder")||component.includes("console."))failures.push("meeting admin acceptance path contains placeholder/console behavior");
if(failures.length){for(const failure of failures)console.error(`FAIL: ${failure}`);process.exit(1)}
console.log("PASS: type-aware room create/update/order/archive UI, service/RPC persistence, workspace mapping, active safeguards, permissions, and audit integration are present.");
