import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [overlay, css, ringtone, hook, app] = await Promise.all([
  read("src/components/voice/VoiceCallOverlays.tsx"),
  read("src/components/voice/voice-call-overlays.css"),
  read("src/services/voice/ringtoneService.ts"),
  read("src/hooks/useVoiceCallInvites.ts"),
  read("src/App.tsx"),
]);

const checks = [
  [overlay.includes("voice-call-card--incoming"), "incoming Mark-style card class is used"],
  [overlay.includes("voice-call-fab--accept"), "accept floating action exists"],
  [overlay.includes("voice-call-fab--message"), "message floating action exists"],
  [overlay.includes("Incoming call"), "DM subtitle labels incoming call"],
  [css.includes("voice-call-card--incoming"), "incoming card styles exist"],
  [css.includes("voice-call-fab"), "floating action styles exist"],
  [ringtone.includes("armUnlockListeners"), "ringtone unlocks after user gesture"],
  [ringtone.includes("440, 480"), "ringtone uses dual-tone phone pattern"],
  [hook.includes("ringtoneService.start()"), "incoming invite starts ringtone"],
  [hook.includes('category: "incoming_call"'), "incoming invite raises notification"],
  [app.includes("onMessage={() =>"), "App wires message-instead for incoming calls"],
  [app.includes("<VoiceCallOverlays"), "App mounts voice call overlays"],
];

const failures = checks.filter(([passed]) => !passed).map(([, label]) => label);
if (failures.length) {
  console.error(`Incoming DM call smoke failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Incoming DM call smoke passed (${checks.length} checks).`);
