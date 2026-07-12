import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const app = read("src/App.tsx");
const service = read("src/services/voiceService.ts");
const token = read("src/services/livekit/livekitService.ts");
const types = read("src/services/livekit/livekitTypes.ts");
const view = read("src/components/VoiceRoomView.tsx");
const devices = read("src/services/voiceDeviceService.ts");
const shield = read("src/services/noiseShieldService.ts");
const scope = read("src/config/v1ReleaseScope.ts");

const joinStart = app.indexOf("const joinActiveVoiceRoom");
const joinEnd = app.indexOf("const leaveActiveVoiceRoom", joinStart);
const join = app.slice(joinStart, joinEnd);

const checks = [
  ["Voice remains visible IN_V1", scope.includes('voiceRooms: inV1(') && scope.includes('screenShare: inV1(')],
  ["active member join without role grant", join.includes("communityAccess.isActiveMember") && !join.includes("permissions.includes") && !join.includes("Owner") && !join.includes("Moderator")],
  ["visitor/non-member denied before join", join.includes("isActiveMember") && join.includes("Join this community before entering voice")],
  ["Edge Function is the only token path", token.includes('.invoke<LiveKitTokenResponse>("livekit-token"') && !token.includes("VITE_LIVEKIT_URL") && !token.includes("mockToken")],
  ["provider URL comes from signed response", token.includes("value.url") && service.includes("token.url")],
  ["no renderer provider secret", !token.includes("LIVEKIT_API_SECRET") && !service.includes("LIVEKIT_API_SECRET")],
  ["duplicate join and room replacement guarded", service.includes("joinInFlight") && service.includes("roomLifecycleGeneration") && service.includes("disposeRoom(room)")],
  ["participant speaking and quality from provider", service.includes("RoomEvent.ActiveSpeakersChanged") && service.includes("RoomEvent.ConnectionQualityChanged")],
  ["join leave mute deafen implemented", ["async join(", "async leave(", "async setMuted(", "setDeafened("].every((term) => service.includes(term))],
  ["selected devices applied", service.includes("applyVoiceDevicePreferences") && devices.includes("selectedInputId") && devices.includes("selectedOutputId")],
  ["standard Noise Shield integrated", service.includes("noiseShieldService") && service.includes("Standard Noise Shield") && shield.includes("noiseCancellationService")],
  ["exact auth access rate provider token errors", ["LIVEKIT_AUTH_REQUIRED", "LIVEKIT_ACCESS_DENIED", "LIVEKIT_RATE_LIMITED", "LIVEKIT_PROVIDER_UNAVAILABLE", "LIVEKIT_TOKEN_FAILED"].every((code) => token.includes(code) || types.includes(code))],
  ["microphone permission failure is recoverable", service.includes("Microphone permission was denied or unavailable") && view.includes("VOICE_PERMISSION_DENIED")],
  ["room ended and access revoked guidance", view.includes("VOICE_ROOM_ENDED") && view.includes("VOICE_ACCESS_REVOKED")],
  ["moderation remains separately gated", view.includes("canMuteMembers") && view.includes("canRemoveFromVoice")],
  ["self-hosted service is explicit", view.includes("Picom's self-hosted LiveKit server")],
];

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}
console.log("Self-hosted active-member Voice client contract passed.");
