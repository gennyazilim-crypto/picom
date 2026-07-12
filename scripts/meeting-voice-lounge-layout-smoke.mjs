import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const lounge = read("src/components/meeting/MeetingVoiceLounge.tsx");
const tile = read("src/components/meeting/MeetingParticipantTile.tsx");
const participantActions = read("src/components/meeting/MeetingParticipantActionsProvider.tsx");
const info = read("src/components/meeting/MeetingInfoPanel.tsx");
const stage = read("src/components/meeting/MeetingStage.tsx");
const dock = read("src/components/meeting/MeetingRightDock.tsx");
const css = read("src/components/meeting/MeetingVoiceLounge.css");
const types = read("src/types/meetingClient.ts");
const service = read("src/services/meeting/meetingService.ts");

for (const marker of ["VerifiedBadge", "connectionQuality", "handRaised", "microphoneEnabled", "isSpeaking"]) assert.ok(tile.includes(marker), `shared participant tile missing ${marker}`);
assert.ok(lounge.includes("snapshot.noiseShield.status") && participantActions.includes("DesktopContextMenu"), "voice lounge Noise Shield or shared participant menu missing");
assert.ok(stage.includes("audioOnly") && stage.includes("MeetingVoiceLounge"), "camera-off rooms must select the voice lounge");
assert.ok(!lounge.match(/black|#000000|video placeholder/i), "voice lounge must not render black video placeholders");
assert.ok(css.includes("data-density=small") && css.includes("data-density=large") && css.includes("prefers-reduced-motion"), "adaptive/reduced-motion styles missing");
assert.ok(dock.includes("onFocusParticipant") && info.includes("Noise Shield requested") && info.includes("Noise Shield applied"), "right dock selection/local shield contract missing");
for (const field of ["verification", "communityRole", "avatarUrl", "username"]) assert.ok(types.includes(field), `participant type missing ${field}`);
assert.ok(service.includes("item.verification") && service.includes("handByParticipant"), "authoritative identity or live hand mapping missing");
console.log("PASS meeting voice lounge layout");
