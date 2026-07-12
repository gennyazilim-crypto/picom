import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const app = read("src/App.tsx");
const card = read("src/components/voice/ConnectedVoiceCard.tsx");
const feed = read("src/components/FeedCompanionRail.tsx");
const profile = read("src/components/ProfileView.tsx");
const directMessages = read("src/components/DirectMessagesView.tsx");
const settings = read("src/components/settings/VoiceDeviceSelection.tsx");
const diagnostics = read("src/services/diagnostics/diagnosticsService.ts");
const diagnosticsUi = read("src/components/settings/DiagnosticsSection.tsx");
const help = read("src/components/HelpCenterView.tsx");
const releaseScope = read("src/config/v1ReleaseScope.ts");

for (const marker of ["voiceState.status !== \"connected\"", "isV1FeatureEnabled(\"voiceRooms\")", "Return to connected voice room", "NoiseShieldCompactStatus", "onToggleMute", "onToggleDeafen", "onLeaveVoice"]) assert.ok(card.includes(marker), `connected voice card missing ${marker}`);
for (const surface of [feed, profile, directMessages]) assert.ok(surface.includes("ConnectedVoiceCard"), "connected voice continuity is missing from a navigation surface");
for (const marker of ["voiceState={voiceSnapshot}", "onToggleVoiceMute={toggleFeedVoiceMute}", "onLeaveVoice={leaveFeedVoice}", "onOpenVoiceRoom={openFeedScreenShare}"]) assert.ok(app.includes(marker), `App voice surface wiring missing ${marker}`);
for (const marker of ["Test microphone", "Test speaker output", "Input sensitivity", "NoiseShieldSettingsPanel", "No screen capture starts from Settings"]) assert.ok(settings.includes(marker), `Voice & Audio settings missing ${marker}`);
for (const marker of ["server_managed", "release_gated", "screenPickerStatus", "tokenExchangeStatus", "remoteScreenShareCount", "lastErrorCode", "joinAttemptCount"]) assert.ok(diagnostics.includes(marker), `safe diagnostics missing ${marker}`);
for (const marker of ["Voice connection", "Token exchange", "Screen picker", "Screen sharing", "Voice attempts", "Voice error"]) assert.ok(diagnosticsUi.includes(marker), `diagnostics UI missing ${marker}`);
assert.ok(!diagnostics.includes("LIVEKIT_API_SECRET") && !diagnostics.includes("LIVEKIT_API_KEY"), "renderer diagnostics must not reference LiveKit credentials");
for (const marker of ["voice-screen-share", "Ordinary members do not need", "Settings > Voice & Audio", "Stop sharing", "Privacy & security > Microphone", "does not capture camera, system audio, or recordings"]) assert.ok(help.includes(marker), `voice help missing ${marker}`);
assert.match(releaseScope, /voiceRooms:\s*hidden\(/, "Task 664 must not enable Voice Rooms before certification");
assert.match(releaseScope, /screenShare:\s*hidden\(/, "Task 664 must not enable Screen Share before certification");
assert.ok(!card.includes("host only") && !card.includes("moderator only"), "ordinary member media controls must not contain role-only copy");

console.log("Member voice and screen UI smoke passed.");
