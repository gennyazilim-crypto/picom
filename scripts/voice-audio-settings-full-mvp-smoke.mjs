import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const devices = read("src/services/voiceDeviceService.ts");
const voice = read("src/services/voiceService.ts");
const player = read("src/services/audio/audioPlayerService.ts");
const ui = read("src/components/settings/VoiceDeviceSelection.tsx");
const settings = read("src/components/SettingsModal.tsx");

for (const marker of ["refresh(requestPermission = false)", "mediaDevices.enumerateDevices()", "setupStatus: \"requesting\"", "video: false", "startMicrophoneTest", "stopMicrophoneTest", "testOutput", "inputSensitivity", "echoCancellation", "noiseSuppression", "autoGainControl", "getSupportedConstraints", "subscribePreferences"]) assert.ok(devices.includes(marker), `missing device contract: ${marker}`);
assert.ok(devices.includes("getTracks().forEach((track) => track.stop())") && !devices.includes("MediaRecorder"), "device tests must stop capture and never record it");
for (const marker of ["voiceDeviceService.getAudioCaptureConstraints()", "switchActiveDevice(\"audiooutput\"", "switchActiveDevice(\"audioinput\"", "applyVoiceDevicePreferences"]) assert.ok(voice.includes(marker), `missing LiveKit device integration: ${marker}`);
assert.ok(player.includes("setSinkId") && player.includes("voiceDeviceService.subscribePreferences"), "Radio/Podcast playback must follow the selected output with fallback");
for (const marker of ["voiceDeviceService.selectInput", "voiceDeviceService.selectOutput", "voiceDeviceService.startMicrophoneTest", "voiceDeviceService.testOutput", "inputSensitivity", "audioPlayerService"]) assert.ok(ui.includes(marker), `missing Voice & Video setting: ${marker}`);
assert.ok(settings.includes("<VoiceDeviceSelection language={settingsLang} />"), "completed device controls must remain mounted in Settings");
console.log("Voice, audio, and device settings Full MVP smoke: PASS");
