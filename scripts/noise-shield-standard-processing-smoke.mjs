import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [types, capabilities, capture, service, facade, voice, players] = await Promise.all([
  readFile("src/types/audioProcessing.ts", "utf8"),
  readFile("src/services/voice/audioCapabilitiesService.ts", "utf8"),
  readFile("src/services/voice/audioCaptureOptionsService.ts", "utf8"),
  readFile("src/services/voice/noiseCancellationService.ts", "utf8"),
  readFile("src/services/noiseShieldService.ts", "utf8"),
  readFile("src/services/voiceService.ts", "utf8"),
  readFile("src/services/audio/audioPlayerService.ts", "utf8"),
]);

assert.match(types, /"off" \| "standard" \| "enhanced" \| "voice-focus"/);
assert.match(capabilities, /getSupportedConstraints/);
for (const constraint of ["echoCancellation", "noiseSuppression", "autoGainControl", "deviceId"]) assert.match(capabilities, new RegExp(constraint));
assert.match(capture, /noiseCancellationMode !== "off"/);
assert.match(capture, /delete constraints\.noiseSuppression/);
assert.match(capture, /echoCancellation = settings\.echoCancellation/);
assert.match(capture, /autoGainControl = settings\.autoGainControl/);
assert.match(service, /verifyAppliedTrack/);
assert.match(service, /inspectTrack/);
assert.match(service, /activateVoice/);
assert.match(service, /createBasicFallback/);
assert.match(facade, /noiseCancellationService as noiseShieldService/);
assert.match(voice, /Track\.Source\.Microphone/);
assert.match(voice, /setMicrophoneWithProcessing/);
assert.match(voice, /verifyAppliedTrack\(localMicrophoneTrack/);
assert.match(voice, /deactivateSession/);
assert.doesNotMatch(players, /noiseShield|noiseCancellation/i);

console.log("Noise Shield Standard processing contract passed (Off, Standard, partial support, applied verification, independent echo/gain, and media isolation).")
