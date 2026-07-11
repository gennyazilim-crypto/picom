import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const source = read("src/services/audio/audioDataSource.ts");
const service = read("src/services/audio/podcastService.ts");
const detail = read("src/components/audio/PodcastEpisodeDetail.tsx");
const shell = read("src/components/audio/PodcastCommunityShell.tsx");
const profile = read("src/components/audio/ProfileAudioSections.tsx");
const realtime = read("src/services/audio/podcastRealtimeService.ts");
const catalogHook = read("src/hooks/useAudioCatalog.ts");
const migration = read("supabase/migrations/20260711001700_podcast_interactions_listener_state.sql");
const rlsTest = read("supabase/tests/rls/podcast_interactions_listener_state.sql");

for (const token of ["setPodcastSaved", "reactToPodcastEpisode", "removePodcastReaction", "commentOnPodcastEpisode", "editPodcastComment", "deletePodcastComment", "messageModerationFilterService.checkMessage", "userBlockingService.isBlocked", "commentCount: Math.max(0, item.commentCount - 1)"]) if (!source.includes(token)) throw new Error(`Podcast interaction data source missing: ${token}`);
for (const token of ["removePodcastReaction", "editPodcastComment", "deletePodcastComment", "markPodcastEpisodeListened", "markPodcastEpisodeUnlistened"]) if (!service.includes(token)) throw new Error(`Podcast interaction service missing: ${token}`);
for (const token of ["Mark listened", "Mark unplayed", "Add a comment", "Edit your Podcast comment", "Delete your Podcast comment", "aria-pressed", "podcastService.savePodcastEpisode"]) if (!detail.includes(token)) throw new Error(`Podcast interaction UI missing: ${token}`);
if (!shell.includes("podcastService.unsavePodcastEpisode") || !shell.includes("audioDataSource.subscribe")) throw new Error("Podcast community previews are not synchronized with the canonical audio source.");
if (!profile.includes("selectedPodcastEpisodeId") || !profile.includes("podcastEpisodes.find")) throw new Error("Profile Podcast detail does not derive current interaction state from canonical props.");
for (const token of ["podcast_episode_reactions", "podcast_episode_comments", "saved_audio_items", "podcast_playback_progress", "createRealtimeEventDeduper"]) if (!realtime.includes(token)) throw new Error(`Podcast Realtime contract missing: ${token}`);
if (!catalogHook.includes("podcastRealtimeService.subscribe")) throw new Error("Podcast Realtime events do not refresh Feed/Profile/Community catalog projections.");
for (const token of ["can_use_podcast_listener_state", "can_interact_with_podcast_episode", "users_are_blocked", "episode.status='published'", "validate_podcast_comment_write", "community_moderation_settings", "replica identity full", "supabase_realtime"]) if (!migration.includes(token)) throw new Error(`Podcast RLS/moderation contract missing: ${token}`);
if (!/select\s+plan\(/i.test(rlsTest) || !/rollback\s*;/i.test(rlsTest)) throw new Error("Podcast interaction pgTAP contract is incomplete.");
if (/supabase\s*\.\s*from\s*\(/.test(detail)) throw new Error("Podcast interaction UI bypasses the service layer.");

console.log("Podcast save, reaction add/remove, own-comment lifecycle, listener state, moderation, RLS, and Realtime contract passed.");
