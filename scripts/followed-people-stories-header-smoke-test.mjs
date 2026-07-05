import { readFileSync } from "node:fs";

const main = readFileSync("src/components/MentionFeedMain.tsx", "utf8");
const header = readFileSync("src/components/MentionFeedHeader.tsx", "utf8");
const storiesComponent = readFileSync("src/components/FollowedPeopleStoriesHeader.tsx", "utf8");
const storiesData = readFileSync("src/data/mockStories.ts", "utf8");
const styles = readFileSync("src/styles.css", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

const storyCount = (storiesData.match(/id: "story-/g) ?? []).length;
const checks = [
  [main.indexOf("<FollowedPeopleStoriesHeader") < main.indexOf("<MentionFeedHeader"), "stories render before tabs"],
  [main.includes("onMarkStorySeen"), "story seen callback wired"],
  [main.includes("onOpenStoryInChannel"), "story open in channel wired"],
  [header.includes("mention-feed-tabs-header"), "old text-heavy header replaced by tabs header"],
  [!header.includes("Mention tracking"), "old Mention Tracking copy removed"],
  [!header.includes("Refresh"), "old refresh action removed"],
  [storiesComponent.includes("StoryCardGrid"), "story card grid component"],
  [storiesComponent.includes("StoryViewerModal"), "story viewer modal component"],
  [storiesComponent.includes("StoryProgressBar"), "story progress bar component"],
  [storiesComponent.includes("StoryViewerControls"), "story viewer controls component"],
  [storiesComponent.includes("window.addEventListener(\"keydown\""), "story modal keyboard support"],
  [storyCount >= 12, "at least twelve followed stories"],
  [(storiesData.match(/type: "status"/g) ?? []).length >= 3, "three status stories"],
  [(storiesData.match(/type: "mention_highlight"/g) ?? []).length >= 3, "three mention highlight stories"],
  [(storiesData.match(/type: "media"/g) ?? []).length >= 2, "two media stories"],
  [(storiesData.match(/type: "voice"/g) ?? []).length >= 2, "two voice stories"],
  [(storiesData.match(/type: "event"/g) ?? []).length >= 1, "one event story"],
  [(storiesData.match(/type: "community_update"/g) ?? []).length >= 1, "one community update story"],
  [styles.includes(".story-card-grid") && styles.includes("overflow-x:auto"), "horizontal story grid overflow safety"],
  [styles.includes("grid-template-rows:auto auto minmax(0,1fr)"), "feed layout rows stories tabs body"],
  [app.includes("mockFollowedUserStories"), "mock stories loaded in app"],
  [app.includes("storyItems"), "local story state in app"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);

if (failed.length) {
  throw new Error(`Followed people stories header smoke test failed: ${failed.join(", ")}`);
}

console.log("Followed people stories header smoke test passed.");
