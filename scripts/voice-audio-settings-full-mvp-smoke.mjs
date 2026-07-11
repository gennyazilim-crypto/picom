import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const devices = read("src/services/voiceDeviceService.ts");
const voice = read("src/services/voiceService.ts");
const player = read("src/services/audio/audioPlayerService.ts");
const ui = read("src/components/settings/VoiceDeviceSelection.tsx");
const settings = read("src/components/SettingsModal.tsx");

for (const marker of ["refresh(requestPermission = false)", "if (!requestPermission && snapshot.permission !== \"granted\")", "startMicrophoneTest", "stopMicrophoneTest", "testOutput", "inputSensitivity", "echoCancellation", "noiseSuppression", "autoGainControl", "getSupportedConstraints", "subscribePreferences"]) assert.ok(devices.includes(marker), `missing device contract: ${marker}`);
assert.ok(devices.includes("getTracks().forEach((track) => track.stop())") && !devices.includes("MediaRecorder"), "device tests must stop capture and never record it");
for (const marker of ["voiceDeviceService.getAudioCaptureConstraints()", "switchActiveDevice(\"audiooutput\"", "switchActiveDevice(\"audioinput\"", "applyVoiceDevicePreferences"]) assert.ok(voice.includes(marker), `missing LiveKit device integration: ${marker}`);
assert.ok(player.includes("setSinkId") && player.includes("voiceDeviceService.subscribePreferences"), "Radio/Podcast playback must follow the selected output with fallback");
for (const marker of ["Test microphone", "Test speaker output", "Input sensitivity", "Radio and Podcast volume", "Not requested by Picom Full MVP", "No screen capture starts from Settings"]) assert.ok(ui.includes(marker), `missing Voice & Video setting: ${marker}`);
assert.ok(settings.includes("permission-gated voice devices") && settings.includes("<VoiceDeviceSelection />"), "completed device controls must remain mounted in Settings");
console.log("Voice, audio, and device settings Full MVP smoke: PASS");
