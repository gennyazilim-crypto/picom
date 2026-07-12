import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [component, css, control, settings, room, feed, mini, dock] = await Promise.all([
  readFile("src/components/voice/NoiseShieldControl.tsx", "utf8"),
  readFile("src/components/voice/NoiseShieldControl.css", "utf8"),
  readFile("src/services/voice/noiseShieldControlService.ts", "utf8"),
  readFile("src/components/settings/VoiceDeviceSelection.tsx", "utf8"),
  readFile("src/components/VoiceRoomView.tsx", "utf8"),
  readFile("src/components/FeedCompanionRail.tsx", "utf8"),
  readFile("src/components/meeting/ConnectedMeetingMiniCard.tsx", "utf8"),
  readFile("src/components/meeting/MeetingControlDock.tsx", "utf8"),
]);

for (const mode of ["off", "standard", "enhanced", "voice-focus"]) assert.match(component, new RegExp(`"${mode}"`));
for (const copy of ["Standard active", "Enhanced filter loading", "Enhanced active", "Voice Focus active", "Not supported on this device", "Permission required", "No microphone detected", "Standard fallback"]) assert.match(component + control, new RegExp(copy));
assert.match(component, /role="radiogroup"/);
assert.match(component, /aria-checked/);
assert.match(component, /Echo cancellation/);
assert.match(component, /Automatic gain control/);
assert.match(component, /Remember for this device/);
assert.match(component, /shared microphone/);
assert.match(component, /NoiseShieldQuickControl/);
assert.match(component, /NoiseShieldCompactStatus/);
assert.match(control, /reapplyMicrophoneProcessing/);
assert.match(settings, /NoiseShieldSettingsPanel/);
assert.match(room, /NoiseShieldQuickControl/);
assert.match(feed, /NoiseShieldCompactStatus/);
assert.match(mini, /Shield:/);
assert.match(dock, /icon="voice"/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /focus-visible/);
assert.doesNotMatch(component + control, /console\.(log|info)|placeholder action/i);

console.log("Noise Shield Settings, Voice Room, Connected Voice, accessibility, fallback, and persistence UI contract passed.");
