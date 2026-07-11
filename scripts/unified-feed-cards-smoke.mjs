import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const list = readFileSync("src/components/UnifiedFeedList.tsx", "utf8");
const main = readFileSync("src/components/MentionFeedMain.tsx", "utf8");
const textCard = readFileSync("src/components/MentionFeedCard.tsx", "utf8");
const audioCard = readFileSync("src/components/audio/AudioFeedCard.tsx", "utf8");
const css = readFileSync("src/components/MentionFeedMain.css", "utf8");

assert.ok(list.includes('kind: "text"') && list.includes('kind: "audio"'), "unified list must merge Text and Audio sources");
assert.ok(list.includes("Date.parse(right.createdAt)"), "mixed source order must be deterministic");
assert.ok(main.includes("<UnifiedFeedList") && !main.includes("<AudioFeedSection"), "Mention Feed must render one unified list");
assert.ok(textCard.includes("unified-feed-card--text"), "Text card must use unified card language");
assert.ok(audioCard.includes("unified-feed-card--audio"), "Audio card must use unified card language");
for (const marker of ["Live now", "Scheduled radio", "Podcast mention", "listening", "Open episode", "Open in Radio", "mentionHighlight", "reactionTotal", "visibleCommenters"]) {
  assert.ok(audioCard.includes(marker), `missing source-correct audio card contract: ${marker}`);
}
assert.ok(audioCard.includes('role="menu"') && audioCard.includes("onToggleSaved(item)") && audioCard.includes("onMarkRead(item)"), "Audio More menu must expose real safe actions");
assert.ok(audioCard.includes("author.verification"), "Audio verified badge must use canonical member verification");
assert.ok(css.includes(".unified-feed-list") && css.includes(".audio-feed-more-menu"), "unified desktop card CSS missing");
assert.ok(!css.includes("bottom-nav"), "mobile navigation must not be introduced");

console.log("Unified Text, Radio, and Podcast Feed cards smoke: PASS");
