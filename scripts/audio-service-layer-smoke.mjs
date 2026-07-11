import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [source, radio, podcast, player, playbackHook, coordinator, hook, communityView, feed, profile] = await Promise.all([
  read("src/services/audio/audioDataSource.ts"),
  read("src/services/audio/radioService.ts"),
  read("src/services/audio/podcastService.ts"),
  read("src/services/audio/audioPlayerService.ts"),
  read("src/components/audio/useAudioPlayback.ts"),
  read("src/services/audio/audioPlaybackCoordinatorService.ts"),
  read("src/hooks/useAudioCatalog.ts"),
  read("src/components/audio/CommunityAudioView.tsx"),
  read("src/components/MentionFeedMain.tsx"),
  read("src/components/ProfileView.tsx"),
]);
for (const fn of ["getCommunityRadioSessions", "getLiveRadioSessions", "getRadioSession", "startRadioSession", "endRadioSession", "listenToRadio", "leaveRadio", "saveRadio", "unsaveRadio"]) {
  if (!radio.includes(fn)) throw new Error(`Missing radioService.${fn}`);
}
for (const fn of ["getCommunityPodcastEpisodes", "getUserPodcastEpisodes", "getPodcastEpisode", "playPodcastEpisode", "savePodcastEpisode", "unsavePodcastEpisode", "reactToPodcastEpisode", "commentOnPodcastEpisode"]) {
  if (!podcast.includes(fn)) throw new Error(`Missing podcastService.${fn}`);
}
if (!source.includes("dataSourceService.getStatus().isMock") || !source.includes("getSupabaseClient")) throw new Error("Mock/Supabase data source split is missing");
if (!player.includes("select(item") || !player.includes("new Audio(source)") || !player.includes("cleanupTransport") || player.includes("autoPlay")) throw new Error("Single audio transport service is unsafe or incomplete");
if (playbackHook.includes("new Audio(") || playbackHook.includes("setInterval")) throw new Error("Component playback hook creates a duplicate or simulated transport");
if (!coordinator.includes("radioRepository.leave") || !coordinator.includes("stopCurrent")) throw new Error("Audio switching does not clean up the active Radio listener");
if (!hook.includes("audioDataSource.subscribe") || !hook.includes("audioDataSource.refresh")) throw new Error("Reactive audio catalog hook is incomplete");
for (const component of [communityView, feed, profile]) {
  if (component.includes("data/mockAudio") || component.includes("supabase.from")) throw new Error("Audio UI is coupled directly to mock or Supabase data");
}
console.log("Audio service mock/Supabase split, UI decoupling, player state, and safe error smoke passed.");
