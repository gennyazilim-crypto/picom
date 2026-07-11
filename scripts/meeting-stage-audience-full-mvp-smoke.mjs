import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [migration, service, client, store, stage, stageView, css, capabilities, databaseTypes] = await Promise.all([
  read("supabase/migrations/20260711155000_stage_audience_mode.sql"),
  read("src/services/meeting/meetingStageService.ts"),
  read("src/services/meeting/meetingService.ts"),
  read("src/stores/meetingStore.ts"),
  read("src/components/meeting/MeetingStage.tsx"),
  read("src/components/meeting/MeetingStageAudience.tsx"),
  read("src/components/meeting/MeetingStageAudience.css"),
  read("src/services/meeting/meetingCapabilityService.ts"),
  read("src/services/supabase/database.types.ts"),
]);

assert.match(migration, /manage_meeting_stage_participant/);
assert.match(migration, /set_meeting_participant_role/);
assert.match(migration, /security definer/i);
assert.match(migration, /revoke all .* from public, anon/i);
assert.match(migration, /stage_request_status/);
assert.match(service, /requestToSpeak/);
assert.match(service, /approveRequest/);
assert.match(service, /promoteParticipant/);
assert.match(service, /demoteParticipant/);
assert.match(client, /refreshAuthorization/);
assert.match(client, /stageQueue:queue\.entries/);
assert.match(store, /stageQueue: \[\]/);
assert.match(stage, /MeetingStageAudience/);
assert.match(stageView, /Participants/);
assert.match(stageView, /Viewers/);
assert.match(stageView, /Request to speak/);
assert.match(stageView, /setVideoSubscriptions/);
assert.match(css, /grid-template-columns/);
assert.match(capabilities, /viewer: capabilities\(\{[\s\S]*canPublishAudio: false, canPublishVideo: false, canShareScreen: false/);
assert.match(capabilities, /guest: capabilities\(\{[\s\S]*canPublishAudio: false, canPublishVideo: false, canShareScreen: false/);
assert.match(databaseTypes, /manage_meeting_stage_participant/);
assert.doesNotMatch(stageView, /supabase\.from|from\(["']meeting_/);
console.log("Meeting stage and audience Full MVP smoke passed.");
