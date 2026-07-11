import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const player = read("src/services/audio/audioPlayerService.ts");
const coordinator = read("src/services/audio/audioPlaybackCoordinatorService.ts");
const progress = read("src/services/audio/podcastProgressService.ts");
const mini = read("src/components/audio/AudioMiniPlayer.tsx");
const globalPlayer = read("src/components/audio/GlobalAudioMiniPlayer.tsx");

for (const token of [
  "let transport: HTMLAudioElement | null",
  "podcastProgressService.get",
  "podcastProgressService.save",
  "pendingResume",
  "PODCAST_PLAYBACK_RATES",
  "playbackRatePreferenceKey",
  "async previous()",
  "async next()",
  "queueIndex",
  "persistPodcastProgress(true)",
  "This Podcast episode is unavailable or private",
]) if (!player.includes(token)) throw new Error(`Podcast player contract missing: ${token}`);

for (const token of ["listPodcastEpisodes", 'episode.status === "published"', "audioPlayerService.select(refreshedItem, resolvedQueue)", "radioRepository.leave"]) if (!coordinator.includes(token)) throw new Error(`Shared playback coordination missing: ${token}`);
for (const token of ["picom.podcastPlaybackProgress.v1", 'onConflict: "user_id,episode_id"', "currentUserId"]) if (!progress.includes(token)) throw new Error(`Per-user Podcast resume persistence missing: ${token}`);
for (const token of ["Podcast playback speed", "Previous episode or restart current episode", "Next episode", 'aria-keyshortcuts="Space ArrowLeft ArrowRight M"', "AudioProgressBar"]) if (!mini.includes(token)) throw new Error(`Accessible Podcast transport UI missing: ${token}`);
if (!globalPlayer.includes('item.type !== "podcast_episode"') || !globalPlayer.includes("markUnavailable")) throw new Error("Unavailable/private Podcast handling is not connected to the global player.");
if ((player.match(/new Audio\(/g) ?? []).length !== 1) throw new Error("Podcast/Radio must share exactly one HTMLAudioElement construction path.");
if (/autoPlay|\.play\(\).*useEffect/.test(mini)) throw new Error("Podcast playback must remain user initiated.");
if (/supabase\s*\.\s*from\s*\(/.test(mini)) throw new Error("Podcast player UI bypasses the service layer.");

console.log("Podcast queue, speed, single transport, secure resume, unavailable-state, and accessibility contract passed.");
