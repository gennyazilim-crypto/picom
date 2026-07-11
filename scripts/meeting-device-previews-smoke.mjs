import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const preJoin = read("src/services/meeting/meetingPreJoinService.ts");
const voice = read("src/services/voiceDeviceService.ts");
const component = read("src/components/meeting/MeetingPreJoin.tsx");

const checks = [
  [preJoin.includes('addEventListener("devicechange"'), "camera device-change monitoring"],
  [preJoin.includes("cameraPreviewGeneration"), "stale camera preview generation guard"],
  [preJoin.includes("track.stop()"), "camera track cleanup"],
  [preJoin.includes("revealLabels && device.label"), "permission-gated camera labels"],
  [preJoin.includes("notifyConsumers: false"), "radio/podcast sink isolation"],
  [voice.includes("getByteTimeDomainData"), "non-recording microphone level meter"],
  [voice.includes("createOscillator"), "generated speaker test tone"],
  [voice.includes("stopOutputTestResources"), "speaker test cleanup"],
  [component.includes("meetingPreJoinService.deactivate()"), "PreJoin unmount cleanup"],
  [!preJoin.includes("MediaRecorder") && !preJoin.includes("getDisplayMedia"), "no recording or screen capture"],
];

const failed = checks.filter(([passed]) => !passed);
if (failed.length) {
  failed.forEach(([, label]) => console.error(`FAIL: ${label}`));
  process.exit(1);
}

console.log(`PASS meeting device previews (${checks.length} checks)`);
