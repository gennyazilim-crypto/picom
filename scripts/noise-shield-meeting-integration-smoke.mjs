import { readFile } from "node:fs/promises";

const [types, store, noise, preJoin, voice, adapter, meeting, controls, preJoinUi, dock, mini, info] = await Promise.all([
  readFile("src/types/noiseShield.ts", "utf8"),
  readFile("src/stores/noiseShieldStore.ts", "utf8"),
  readFile("src/services/noiseShieldService.ts", "utf8"),
  readFile("src/services/meeting/meetingPreJoinService.ts", "utf8"),
  readFile("src/services/voiceService.ts", "utf8"),
  readFile("src/services/meeting/meetingLiveKitAdapter.ts", "utf8"),
  readFile("src/services/meeting/meetingService.ts", "utf8"),
  readFile("src/services/meeting/meetingControlService.ts", "utf8"),
  readFile("src/components/meeting/MeetingPreJoin.tsx", "utf8"),
  readFile("src/components/meeting/MeetingControlDock.tsx", "utf8"),
  readFile("src/components/meeting/ConnectedMeetingMiniCard.tsx", "utf8"),
  readFile("src/components/meeting/MeetingInfoPanel.tsx", "utf8"),
]);

const checks = [
  [types.includes('"off" | "standard" | "enhanced" | "voice_focus"') && store.includes("noiseShieldStore"), "one canonical requested/applied model and store"],
  [noise.includes('standard ? ["off", "standard"] : ["off"]') && !noise.includes('["off", "standard", "enhanced", "voice_focus"]'), "only real runtime/provider modes are offered"],
  [noise.includes('scope: "meeting"') && noise.includes("createMicrophoneCapturePlan") && noise.includes("noiseSuppression: true"), "processing is meeting microphone scoped"],
  [noise.includes("supported.echoCancellation") && noise.includes("supported.autoGainControl"), "optional Chromium constraints are capability gated"],
  [preJoin.includes("createMicrophoneCapturePlan") && preJoin.includes("setNoiseShieldMode"), "PreJoin microphone test uses canonical capture plan"],
  [voice.includes("setMicrophoneWithMeetingProcessing") && voice.includes("reapplyMicrophoneProcessing") && voice.includes("markFallback"), "one microphone helper handles replacement and fallback"],
  [voice.match(/setMicrophoneWithMeetingProcessing/g)?.length >= 4, "connect, switch, unmute, and reconnect reapply processing"],
  [adapter.includes("reapplyNoiseShield") && meeting.includes("noiseShieldService.subscribe") && meeting.includes("deactivateMeeting"), "meeting lifecycle subscribes, reapplies, and cleans up"],
  [controls.includes("setNoiseShieldMode") && preJoinUi.includes("noiseShieldAvailableModes.map") && dock.includes("noiseShield.availableModes.map"), "PreJoin and control dock expose only available modes"],
  [mini.includes("appliedMode") && mini.includes("fallbackReason") && info.includes("Noise Shield requested") && info.includes("Noise Shield applied"), "mini card and diagnostics report applied/fallback truthfully"],
  [!noise.includes("screenShare") && !noise.includes("radio") && !noise.includes("podcast"), "Noise Shield service does not attach to non-microphone media"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error(`FAIL: ${label}`);
  process.exit(1);
}
for (const [, label] of checks) console.log(`PASS: ${label}`);
console.log("Noise Shield meeting integration contract passed.");
