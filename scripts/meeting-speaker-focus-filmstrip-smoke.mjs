import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const hook = read("src/hooks/useStableMeetingSpeaker.ts");
const focus = read("src/components/meeting/MeetingSpeakerFocus.tsx");
const tile = read("src/components/meeting/MeetingParticipantTile.tsx");
const css = read("src/components/meeting/MeetingSpeakerFocus.css");
const stage = read("src/components/meeting/MeetingStage.tsx");

assert.ok(hook.includes("MEETING_SPEAKER_DEBOUNCE_MS = 650") && hook.includes("MEETING_SPEAKER_SILENCE_HOLD_MS = 1_600"), "speaker hysteresis constants missing");
assert.ok(hook.includes("if (manualPinId) return") && focus.includes("manualPin ?? automaticSpeaker"), "manual pin must override automatic focus");
assert.ok(focus.includes("FILMSTRIP_PAGE_SIZE = 7") && focus.includes("Previous") && focus.includes("Next"), "filmstrip pagination missing");
for (const marker of ["cameraStream", "handRaised", "microphoneEnabled", "isSpeaking"]) assert.ok(tile.includes(marker), `shared focus/filmstrip tile missing ${marker}`);
for (const marker of ["aria-pressed", "setVideoSubscriptions"]) assert.ok(focus.includes(marker), `speaker focus missing ${marker}`);
assert.ok(css.includes("grid-template-columns:repeat(7") && css.includes("overflow:hidden"), "stable filmstrip layout missing");
assert.ok(stage.includes('snapshot.layout === "speaker"') && stage.includes("MeetingSpeakerFocus"), "speaker layout routing missing");
console.log("PASS meeting speaker focus and participant filmstrip");
