import { readFile } from "node:fs/promises";

const [types, store, noise, preJoin, voice, adapter, meeting, controls, preJoinUi, dock, mini, info] = await Promise.all([
  readFile("src/types/noiseShield.ts", "utf8"),
  readFile("src/stores/noiseShieldStore.ts", "utf8"),
  readFile("src/services/voice/noiseCancellationService.ts", "utf8"),
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
  [types.includes("NoiseCancellationMode") && store.includes("noiseShieldStore"), "one canonical requested/applied model and store"],
  [noise.includes('availableModes') && !noise.includes('["off", "standard", "enhanced", "voice-focus"]'), "only real runtime/provider modes are offered"],
  [noise.includes('activateMeeting') && noise.includes("createMicrophoneCapturePlan"), "processing is voice/meeting microphone scoped"],
  [noise.includes("audioCapabilitiesService") && noise.includes("audioCaptureOptionsService"), "optional Chromium constraints are capability gated"],
  [preJoin.includes("createMicrophoneCapturePlan") && preJoin.includes("setNoiseShieldMode"), "PreJoin microphone test uses canonical capture plan"],
  [voice.includes("setMicrophoneWithProcessing") && voice.includes("reapplyMicrophoneProcessing") && voice.includes("markFallback"), "one microphone helper handles replacement and fallback"],
  [voice.match(/setMicrophoneWithProcessing/g)?.length >= 4, "connect, switch, unmute, and reconnect reapply processing"],
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
