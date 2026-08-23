import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const band = readFileSync("src/components/FeedLiveNowPreviewBand.tsx", "utf8");
const css = readFileSync("src/components/FeedLiveNowPreviewBand.css", "utf8");
const main = readFileSync("src/components/MentionFeedMain.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

assert.ok(band.includes("listVisibleLiveShares"), "Live Now uses canonical list service");
assert.ok(band.includes("subscribeToVisibleLiveShares"), "Live Now realtime subscription required");
assert.ok(band.includes('status === "live"') || band.includes('status === "reconnecting"'), "only active streams");
assert.ok(band.includes("onOpenLiveSession"), "card opens Live Watch");
assert.ok(band.includes("feed-live-now"), "Live Now band class");
assert.ok(css.includes(".feed-live-now"), "Live Now styles present");
assert.ok(main.includes("FeedLiveNowPreviewBand"), "Feed mounts Live Now band");
assert.ok(!main.includes("FollowedPeopleStoriesHeader"), "Stories header must not mount on Feed");
assert.ok(app.includes("onOpenLiveSession"), "App wires Live Watch navigation");
assert.ok(app.includes("setLiveWatchSessionId") || app.includes("liveSessionId"), "canonical Live Watch route wiring");

console.log("Feed Live Now Preview smoke: PASS");
