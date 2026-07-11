import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [devices, voice, recovery, settings, diagnostics, app] = await Promise.all([
  read("src/services/voiceDeviceService.ts"),
  read("src/services/voiceService.ts"),
  read("src/services/voiceSessionRecoveryService.ts"),
  read("src/components/settings/VoiceDeviceSelection.tsx"),
  read("src/services/diagnostics/diagnosticsService.ts"),
  read("src/App.tsx"),
]);

const checks = [
  [devices.includes('addEventListener("devicechange"'), "device changes refresh enumeration"],
  [devices.includes("The selected microphone was removed"), "removed microphones recover with user feedback"],
  [devices.includes("getPermissionGuidance"), "platform permission guidance is centralized"],
  [!devices.includes("MediaRecorder"), "device handling never records audio"],
  [voice.includes("reconnectBackoffMs"), "reconnect uses bounded backoff"],
  [voice.includes("reconnectInFlight"), "duplicate reconnects are coalesced"],
  [voice.includes("reconnectGeneration"), "leave or room switch cancels stale reconnects"],
  [voice.includes("desiredMuted") && voice.includes("desiredDeafened"), "mute and deafen survive recovery"],
  [recovery.includes("sleepWakeResumeService.onResume"), "desktop resume drives recovery"],
  [recovery.includes("voiceDeviceService.refresh(false)"), "devices refresh after resume"],
  [recovery.includes("voiceService.canReconnect()"), "only recoverable sessions reconnect"],
  [settings.includes("permissionGuidance"), "Settings exposes platform guidance"],
  [diagnostics.includes("deviceErrorCount") && diagnostics.includes("sessionDurationBucket"), "diagnostics expose redacted voice health"],
  [!diagnostics.includes("roomContext") && !diagnostics.includes("roomName"), "diagnostics exclude room identity"],
  [app.includes("voiceSessionRecoveryService.start()"), "recovery coordinator starts with the voice client"],
];

const failures = checks.filter(([passed]) => !passed).map(([, label]) => label);
if (failures.length) {
  console.error(`Voice devices/reconnect smoke failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`Voice devices, permissions, and reconnect Full MVP smoke passed (${checks.length} checks).`);
