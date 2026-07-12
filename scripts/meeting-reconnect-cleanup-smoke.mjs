import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const [voice, meeting, store, recovery, gateway] = await Promise.all([
  read("src/services/voiceService.ts"),
  read("src/services/meeting/meetingService.ts"),
  read("src/stores/meetingStore.ts"),
  read("src/services/voiceSessionRecoveryService.ts"),
  read("src/components/meeting/MeetingDeepLinkGateway.tsx"),
]);

const checks = [
  [voice.includes("DisconnectReason.PARTICIPANT_REMOVED") && voice.includes("DisconnectReason.ROOM_DELETED") && voice.includes("DisconnectReason.DUPLICATE_IDENTITY"), "terminal LiveKit disconnects are classified"],
  [voice.includes("VOICE_ACCESS_REVOKED") && voice.includes("VOICE_ROOM_ENDED") && voice.includes("VOICE_SESSION_REPLACED"), "terminal failures stay distinct from network recovery"],
  [voice.includes("async function disposeRoom") && voice.includes("await activeRoom.disconnect(false)"), "Room cleanup is awaited and centralized"],
  [voice.includes("roomLifecycleGeneration") && voice.includes("room !== activeRoom"), "stale async connects cannot republish media"],
  [voice.includes("cancelReconnectDelay") && voice.includes("reconnectBackoffMs"), "voice retry timers are bounded and cancellable"],
  [meeting.includes("meetingReconnectBackoffMs") && meeting.includes("scheduleMeetingReconnect"), "meeting reconnect is bounded and coalesced"],
  [meeting.includes("meetingLiveKitAdapter.authorize(request)") && meeting.includes("joinSerialized(request,true)"), "every meeting reconnect obtains fresh backend authorization"],
  [meeting.includes('errorCode === "VOICE_ROOM_ENDED"'), "ended rooms do not retry"],
  [meeting.includes("currentRequest=null;cancelMeetingReconnect();stopBindings()"), "leave cancels retry and drains subscriptions before provider shutdown"],
  [meeting.includes("participantsById:{}") && meeting.includes("participantIds:[]"), "leave clears participant state"],
  [meeting.includes("snapshot.participants.map") && meeting.includes("meetingStore.replaceParticipants(generation,participants)"), "provider reconciliation removes ghost participants"],
  [store.includes('reconnecting: ["token-loading"') && store.includes('failed: ["idle", "prejoin", "token-loading", "reconnecting"'), "store permits bounded reauthorization transitions"],
  [recovery.includes("cancelPendingResumeDelay") && recovery.includes("window.clearTimeout(pendingResumeTimer)"), "sleep/wake timers are canceled on shutdown"],
  [gateway.includes('window.addEventListener("beforeunload",shutdown)') && gateway.includes('window.removeEventListener("beforeunload",shutdown)'), "Electron renderer shutdown cleanup is paired"],
  [!voice.includes("MediaRecorder"), "meeting recovery never records media"],
];

const failures = checks.filter(([passed]) => !passed).map(([, label]) => label);
if (failures.length) {
  console.error(`Meeting reconnect/cleanup smoke failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`Meeting reconnect, token refresh, and resource cleanup smoke passed (${checks.length} checks).`);
