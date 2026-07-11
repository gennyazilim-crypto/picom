import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [detail, communityView, feed, profileAudio] = await Promise.all([read("src/components/audio/PodcastEpisodeDetail.tsx"), read("src/components/audio/CommunityAudioView.tsx"), read("src/components/MentionFeedMain.tsx"), read("src/components/audio/ProfileAudioSections.tsx")]);
for (const name of ["PodcastEpisodeDetail", "PodcastEpisodeHeader", "PodcastEpisodePlayer", "PodcastEpisodeDescription", "PodcastEpisodeCommentsPreview", "PodcastRelatedEpisodes"]) {
  if (!detail.includes(`function ${name}`)) throw new Error(`Missing ${name}`);
}
if (!detail.includes("AudioMiniPlayer") || !detail.includes("podcastService.savePodcastEpisode") || !detail.includes("podcastService.unsavePodcastEpisode")) throw new Error("Podcast playback or persistent save state is incomplete");
if (!communityView.includes("selectedPodcastEpisode") || !communityView.includes("<PodcastEpisodeDetail")) throw new Error("Community podcast detail entry is missing");
if (!feed.includes("selectedPodcastEpisodeId") || !feed.includes("<PodcastEpisodeDetail")) throw new Error("Mention Feed podcast detail entry is missing");
if (!profileAudio.includes("selectedPodcastEpisode") || !profileAudio.includes("<PodcastEpisodeDetail")) throw new Error("Profile podcast detail entry is missing");
if (detail.includes("supabase") || detail.includes("autoPlay") || detail.includes("dangerouslySetInnerHTML")) throw new Error("Podcast detail must stay local, explicit-play, and safe-rendered");
console.log("Podcast detail feed, profile, community, player, save, comments, and related episode smoke passed.");
