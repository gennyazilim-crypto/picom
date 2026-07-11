import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contracts = [
  "scripts/message-mentions-extraction-smoke.mjs",
  "scripts/unified-content-mentions-smoke.mjs",
  "scripts/mention-feed-ranking-v2-test.mjs",
  "scripts/mention-feed-supabase-smoke.mjs",
  "scripts/comment-preview-production-model-smoke.mjs",
  "scripts/unified-feed-query-smoke.mjs",
  "scripts/unified-feed-cards-smoke.mjs",
  "scripts/feed-tabs-stories-filters-smoke.mjs",
  "scripts/followed-people-stories-header-smoke-test.mjs",
  "scripts/followed-stories-supabase-smoke.mjs",
  "scripts/feed-actions-deep-links-smoke.mjs",
  "scripts/feed-companion-rail-smoke-test.mjs",
  "scripts/feed-companion-integration-smoke.mjs",
  "scripts/feed-realtime-cache-smoke.mjs",
  "scripts/audio-feed-integration-smoke.mjs",
  "scripts/profile-verification-badges-smoke-test.mjs",
  "scripts/blocking-privacy-enforcement-smoke-test.mjs",
];

for (const contract of contracts) {
  const result = spawnSync(process.execPath, [resolve(root, contract)], { cwd: root, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`Feed QA contract failed: ${contract}`);
}

const read = (path) => readFileSync(resolve(root, path), "utf8");
const app = read("src/App.tsx");
const feedMain = read("src/components/MentionFeedMain.tsx");
const rail = read("src/components/FeedCompanionRail.tsx");
const sourceTypes = read("src/types/contentMentions.ts");
const feedMigration = read("supabase/migrations/20260711148200_feed_realtime_unread_projection.sql");

for (const stale of [
  "Mention feed message highlight placeholder prepared",
  "Story message highlight placeholder prepared",
  "details are a local placeholder",
  "stay local in this task",
  "onScreenSharePlaceholder",
]) {
  if (app.includes(stale) || feedMain.includes(stale) || rail.includes(stale)) throw new Error(`Feed acceptance placeholder remains: ${stale}`);
}
for (const sourceType of ["text_message", "radio_session", "radio_chat", "podcast_episode", "podcast_comment"]) {
  if (!sourceTypes.includes(`\"${sourceType}\"`)) throw new Error(`Feed source type missing: ${sourceType}`);
}
for (const marker of ["canViewChannel(targetAccess, targetChannel)", "setHighlightedMessageId(story.messageId)", "openFeedScreenShare", "rememberRadioSession", "openFeedEventDetails"]) {
  if (!app.includes(marker)) throw new Error(`Feed navigation contract missing: ${marker}`);
}
for (const marker of ["security_invoker = true", "public.can_view_message(message.id)", "is_unread", "pg_publication_tables"]) {
  if (!feedMigration.includes(marker)) throw new Error(`Feed privacy/realtime migration marker missing: ${marker}`);
}

console.log(`Feed Full MVP QA passed (${contracts.length} feature contracts).`);
