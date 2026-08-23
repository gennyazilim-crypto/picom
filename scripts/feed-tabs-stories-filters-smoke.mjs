import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync("src/components/MentionFeedMain.tsx", "utf8");
const tabs = readFileSync("src/components/MentionFeedTabs.tsx", "utf8");
const ui = readFileSync("src/services/feed/feedUiStateService.ts", "utf8");

assert.ok(
  tabs.includes('onTabChange("feed")')
    && tabs.includes('onTabChange("following")')
    && tabs.includes(">Feed<")
    && tabs.includes(">Takip<"),
  "two Feed tabs must remain",
);
assert.ok(main.includes("feedQueryService.refresh") && main.includes("queriedSourceOrder"), "tabs must use ranked query ordering");
assert.ok(main.includes("sourceTypesForFilter") && main.includes("createdAfterForFilter"), "filters must reach query contract");
assert.ok(ui.includes("localStorage") && ui.includes("setSelection"), "Feed UI state persistence missing");
assert.ok(!main.includes("FollowedPeopleStoriesHeader"), "Stories strip must stay removed from Feed");
assert.ok(main.includes("FeedLiveNowPreviewBand"), "Live Now Preview replaces Stories band");
assert.ok(!`${main}${tabs}`.includes("Mention Tracking"), "old text-heavy header must stay removed");
console.log("Feed tabs, filters, and Live Now persistence smoke: PASS");
