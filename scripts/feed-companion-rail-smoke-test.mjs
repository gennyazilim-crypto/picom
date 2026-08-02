import { readFileSync } from "node:fs";

const main = readFileSync("src/components/MentionFeedMain.tsx", "utf8");
const rail = readFileSync("src/components/FeedCompanionRail.tsx", "utf8");
const styles = readFileSync("src/components/MentionFeedMain.css", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

const checks = [
  [main.includes("mention-feed-body-grid"), "body grid below mention feed header"],
  [main.includes("<FeedCompanionRail"), "companion rail mounted beside mention cards"],
  [!main.includes("FollowedPeopleStoriesHeader"), "stories header removed from Feed"],
  [main.includes("FeedLiveNowPreviewBand") || main.includes("feed-live-now"), "Live Now Preview band on Feed"],
  [rail.includes("VoiceMiniControlCard"), "voice mini control card component"],
  [rail.includes("FriendsStatusSection"), "friends status section"],
  [rail.includes("UpcomingEventsSection"), "upcoming events section"],
  [rail.includes("onLeaveVoice"), "leave voice handler wired"],
  [rail.includes("aria-label={voiceState.muted"), "mute button accessible label"],
  [rail.includes("aria-label={voiceState.deafened"), "deafen button accessible label"],
  [!rail.includes("mockFriends") && !rail.includes("mockEvents"), "companion rail has no mock data imports"],
  [styles.includes(".feed-companion-rail"), "companion rail styles"],
  [styles.includes(".feed-rail-sticky-stack") && /position:\s*sticky/.test(styles), "sticky voice mini card"],
  [/@media\s*\(max-width:\s*1380px\)/.test(styles), "desktop width collapse rule"],
  [app.includes("voiceSnapshot"), "LiveKit-backed feed voice state"],
  [app.includes("visibleCommunityEvents"), "real community events passed to feed"],
  [!app.includes("mockUpcomingEvents"), "mock event data not passed to feed"],
  [!/activeView === "mentionFeed"[\s\S]*mockPopularUserIds/.test(app), "mock popular IDs not used on Feed view"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);

if (failed.length) {
  throw new Error(`Feed companion rail smoke test failed: ${failed.join(", ")}`);
}

console.log("Feed companion rail voice/friends/events smoke test passed.");
