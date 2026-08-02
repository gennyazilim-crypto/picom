import { readFileSync } from "node:fs";

const main = readFileSync("src/components/MentionFeedMain.tsx", "utf8");
const header = readFileSync("src/components/MentionFeedHeader.tsx", "utf8");
const band = readFileSync("src/components/FeedLiveNowPreviewBand.tsx", "utf8");
const styles = readFileSync("src/components/MentionFeedMain.css", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

const checks = [
  [main.includes("FeedLiveNowPreviewBand"), "Live Now Preview band mounted on Feed"],
  [!main.includes("FollowedPeopleStoriesHeader"), "Stories header removed from Feed"],
  [!main.includes("StoryViewerModal"), "Story viewer not used on Feed"],
  [!main.includes("onMarkStorySeen"), "story seen callback removed"],
  [!main.includes("onOpenStoryInChannel"), "story open callback removed"],
  [header.includes("mention-feed-tabs-header"), "tabs header remains"],
  [!header.includes("Mention tracking"), "old Mention Tracking copy removed"],
  [band.includes("listVisibleLiveShares"), "Live Now uses canonical service"],
  [!styles.includes(".followed-stories-header"), "Feed CSS no longer owns stories strip"],
  [!app.includes("storyItems"), "App no longer keeps Feed story state"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) throw new Error(`Feed Live Now / stories cleanup smoke failed: ${failed.join(", ")}`);
console.log("Feed Live Now / stories cleanup smoke: PASS");
