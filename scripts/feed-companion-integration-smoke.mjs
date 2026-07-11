import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const requireText = (source, value, label) => {
  if (!source.includes(value)) throw new Error(`${label}: missing ${value}`);
};
const rejectText = (source, value, label) => {
  if (source.includes(value)) throw new Error(`${label}: stale ${value}`);
};

const app = read("src/App.tsx");
const rail = read("src/components/FeedCompanionRail.tsx");
const feed = read("src/components/MentionFeedMain.tsx");
const styles = read("src/components/MentionFeedMain.css");
const miniPlayer = read("src/components/audio/AudioMiniPlayer.tsx");
const globalPlayer = read("src/components/audio/GlobalAudioMiniPlayer.tsx");
const presence = read("src/services/friends/friendPresenceService.ts");

requireText(app, 'hidden={activeView === "mentionFeed"}', "single audio presentation owner");
requireText(rail, 'className="feed-rail-sticky-stack"', "sticky companion controls");
requireText(rail, "<AudioMiniPlayer item={audioItem ?? undefined}", "rail audio player");
requireText(rail, "voiceState.status !== \"connected\"", "actual voice connection state");
requireText(rail, "onToggleMute", "voice mute control");
requireText(rail, "onToggleDeafen", "voice deafen control");
requireText(rail, "onLeaveVoice", "voice leave control");
requireText(rail, "onOpenProfile(event, displayMember)", "friend profile navigation");
requireText(feed, "audioCatalog.radioSessions", "Radio schedule events");
requireText(feed, "audioItem={selectedAudio}", "Feed audio selection handoff");
requireText(styles, ".feed-rail-sticky-stack{position:sticky", "sticky rail CSS");
requireText(styles, "@media (max-width: 1380px)", "medium desktop collapse");
rejectText(miniPlayer, "if (item) return null", "embedded player visibility");
requireText(globalPlayer, "if (!player.item || hidden) return null", "global dock suppression in Feed");
requireText(presence, 'table: "friend_presence"', "realtime friend presence");

console.log("Feed companion rail integration contract passed.");
