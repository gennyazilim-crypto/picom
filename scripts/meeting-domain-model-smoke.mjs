import { readFile } from "node:fs/promises";

const [domain, capabilities, fixtures, voiceTypes, voiceService] = await Promise.all([
  readFile("src/types/meeting.ts", "utf8"),
  readFile("src/services/meeting/meetingCapabilityService.ts", "utf8"),
  readFile("src/data/mockMeetingFixtures.ts", "utf8"),
  readFile("src/types/voice.ts", "utf8"),
  readFile("src/services/voiceService.ts", "utf8"),
]);

const failures = [];
const requireText = (source, values, label) => {
  for (const value of values) if (!source.includes(value)) failures.push(`${label} missing ${value}`);
};

requireText(domain, [
  "MeetingRoom", "MeetingSession", "MeetingParticipant", "MeetingRole", "MeetingCapabilities",
  "MeetingLayout", "MeetingTrackState", "MeetingConnectionState", "WaitingRoomEntry",
  "MeetingInvite", "MeetingReaction", "RaisedHandState", "MeetingEvent",
  "community_channel", "scheduled_event", "ad_hoc",
  "scheduled", "open", "live", "ended", "cancelled", "locked",
  "MeetingBackendSnapshot", "MeetingProviderEvent", "MeetingClientStoreSnapshot",
], "canonical meeting domain");

requireText(capabilities, [
  "MEETING_ROLE_CAPABILITIES", "mapCommunityStatusToMeetingRole",
  "getMeetingCapabilitiesForCommunityAccess", "host", "cohost", "speaker", "participant", "viewer", "guest",
], "capability model");

requireText(fixtures, ["voice:", "meeting:", "stage:", "camera_off:", "screen_share:", "waiting_room:", "failure:"], "fixtures");
requireText(voiceTypes, ["MeetingConnectionState", "MeetingFixtureMode", "from \"./meeting\""], "voice type adaptation");
requireText(voiceService, ["MeetingTransportConnectionState", "Pick<MeetingParticipant", "Pick<MeetingRoomContext"], "voice service adaptation");

if (/token:\s*string|MediaStream/.test(domain.split("export type MeetingClientStoreSnapshot")[1]?.split("export type SerializedMeetingEventEnvelope")[0] ?? "")) {
  failures.push("client store serialization boundary must not contain provider tokens or raw media");
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log("PASS: canonical meeting domain, capability mapping, safe boundaries, voice compatibility, and seven deterministic fixture modes are present.");
