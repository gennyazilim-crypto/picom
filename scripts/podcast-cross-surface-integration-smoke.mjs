import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const audioTypes = read("src/types/audio.ts");
const source = read("src/services/audio/audioDataSource.ts");
const card = read("src/components/audio/AudioFeedCard.tsx");
const feed = read("src/components/MentionFeedMain.tsx");
const profile = read("src/components/audio/ProfileAudioSections.tsx");
const community = read("src/components/audio/PodcastCommunityShell.tsx");
const search = read("src/services/advancedSearchService.ts");
const deepLinks = read("src/services/deepLinkService.ts");
const nativeValidation = read("electron/ipcPayloadValidation.cts");
const preload = read("electron/preload.cts");
const app = read("src/App.tsx");
const notificationCenter = read("src/services/notificationCenterService.ts");
const notificationInbox = read("src/services/supabase/notificationInboxService.ts");
const databaseTypes = read("src/services/supabase/database.types.ts");
const migration = read("supabase/migrations/20260711001800_podcast_cross_surface_integration.sql");
const rlsTest = read("supabase/tests/rls/podcast_cross_surface_integration.sql");

for (const token of ["isMention?:", "mentionSource?:", "mentionHighlight?:", "mentionAuthorUserId?:"]) {
  if (!audioTypes.includes(token)) throw new Error(`Podcast feed contract missing: ${token}`);
}

for (const token of ["containsMention", "mockViewerMentionTokens", "mentionSource", "episode_comment", "episode_description", "status === \"published\""]) {
  if (!source.includes(token)) throw new Error(`Podcast source projection missing: ${token}`);
}

for (const token of ["Podcast mention", "Open episode", "Open community", "mentionHighlight", "listenerCount", "commenterIds"]) {
  if (!card.includes(token)) throw new Error(`Podcast Feed card integration missing: ${token}`);
}

for (const token of ["item.mentionAuthorUserId", "sourceId", "podcastService.reactToPodcastEpisode", "podcastService.removePodcastReaction"]) {
  if (!feed.includes(token)) throw new Error(`Mention Feed Podcast behavior missing: ${token}`);
}

if (!profile.includes("selectedPodcastEpisodeId") || !profile.includes("podcastEpisodes.find")) {
  throw new Error("Profile Podcast content is not projected from canonical episode state.");
}
if (!community.includes("podcastService.unsavePodcastEpisode") || !community.includes("audioDataSource.subscribe")) {
  throw new Error("Community Podcast content is not synchronized through the canonical service layer.");
}

for (const token of ["Podcasts", "podcast_episode", "podcastEpisodeId", "searchPodcasts", "status", "published", "podcast_episode_comments"]) {
  if (!search.includes(token)) throw new Error(`Podcast search integration missing: ${token}`);
}

for (const token of ["type: \"podcast\"", "podcast", "episodeId"]) {
  if (!deepLinks.includes(token)) throw new Error(`Renderer Podcast deep-link contract missing: ${token}`);
}
for (const [name, value] of [["native", nativeValidation], ["preload", preload]]) {
  if (!value.includes('route === "radio" || route === "podcast"') || !value.includes('route === "radio" ? "session" : "episode"')) {
    throw new Error(`${name} Podcast deep-link validation is missing.`);
  }
}

for (const token of ["openPodcastEpisodeSource", "action.type === \"podcast\"", "result.podcastEpisodeId", "item.context.podcastEpisodeId"]) {
  if (!app.includes(token)) throw new Error(`App Podcast routing integration missing: ${token}`);
}

for (const token of ["podcastEpisodeId", "decideNotificationRoute"]) {
  if (!notificationCenter.includes(token)) throw new Error(`Podcast notification routing missing: ${token}`);
}
if (!notificationInbox.includes("podcast_episode_id") || !databaseTypes.includes("podcast_episode_id")) {
  throw new Error("Podcast notification inbox schema projection is incomplete.");
}

for (const token of ["enqueue_podcast_mentions", "episode.status='published'", "community_members", "users_are_blocked", "podcast_episode_id", "source_event_id", "security definer", "revoke all"]) {
  if (!migration.toLowerCase().includes(token.toLowerCase())) throw new Error(`Podcast notification SQL safety contract missing: ${token}`);
}
if (!/select\s+plan\(/i.test(rlsTest) || !/rollback\s*;/i.test(rlsTest)) {
  throw new Error("Podcast cross-surface pgTAP contract is incomplete.");
}

for (const ui of [card, feed]) {
  if (/supabase\s*\.\s*from\s*\(/.test(ui)) throw new Error("Podcast Feed UI bypasses the service layer.");
}

console.log("Podcast Feed, Profile, Community, search, exact deep-link, notification, privacy, and RLS integration contract passed.");
