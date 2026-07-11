import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [tile, css, fixtures, grid, speaker, lounge, stage, share, manifest] = await Promise.all([
  read("src/components/meeting/MeetingParticipantTile.tsx"), read("src/components/meeting/MeetingParticipantTile.css"), read("src/data/meetingParticipantTileFixtures.ts"),
  read("src/components/meeting/MeetingVideoGrid.tsx"), read("src/components/meeting/MeetingSpeakerFocus.tsx"), read("src/components/meeting/MeetingVoiceLounge.tsx"), read("src/components/meeting/MeetingStageAudience.tsx"), read("src/components/meeting/MeetingScreenShareFocus.tsx"), read("tests/visual/visual-regression-manifest.json"),
]);
for (const source of [grid, speaker, lounge, stage, share]) assert.match(source, /MeetingParticipantTile/);
for (const state of ["isSpeaking", "microphoneEnabled", "cameraEnabled", "handRaised", "screenSharing", "connectionQuality", "presence", "verification"]) assert.match(tile, new RegExp(state));
for (const variant of ["grid", "focus", "filmstrip", "voice", "stage", "share"]) assert.match(tile, new RegExp(`\\"${variant}\\"`));
for (const fixture of ["camera", "avatar", "verified", "speaking", "hand", "sharing", "poor", "selected"]) assert.match(fixtures, new RegExp(`id: \\"${fixture}\\"`));
assert.match(css, /prefers-reduced-motion/);assert.match(css, /focus-visible/);assert.match(css, /var\(--picom-teal\)/);assert.doesNotMatch(tile, /providerSid|trackSid|providerIdentity/);
const parsed = JSON.parse(manifest);assert.equal(parsed.scenarios.filter((item) => item.screen === "meetingParticipantTiles").length, 2);
console.log("Meeting participant tile visual and state contract smoke passed.");
