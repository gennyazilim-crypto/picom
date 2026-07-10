import fs from "node:fs";

const service = fs.readFileSync("src/services/voiceDeviceService.ts", "utf8");
const component = fs.readFileSync("src/components/settings/VoiceDeviceSelection.tsx", "utf8");
const settings = fs.readFileSync("src/components/SettingsModal.tsx", "utf8");

for (const needle of ["enumerateDevices", "getUserMedia", "devicechange", "selectedInputId", "selectedOutputId", "picom.voice-device-preferences.v1"]) {
  if (!service.includes(needle)) throw new Error(`Voice device service is missing ${needle}`);
}
for (const needle of ["Allow microphone and load devices", "No microphones available", "System default output", "voiceDeviceService.selectInput"]) {
  if (!component.includes(needle)) throw new Error(`Voice device UI is missing ${needle}`);
}
if (!settings.includes("<VoiceDeviceSelection />")) throw new Error("Voice device settings are not mounted in SettingsModal");

console.log("Voice device selection smoke passed.");
