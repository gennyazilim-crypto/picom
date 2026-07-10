import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const paths = [
  "src/types/audio.ts",
  "src/data/mockAudio.ts",
  "src/components/audio/AudioPlayer.tsx",
  "src/components/audio/AudioMiniPlayer.tsx",
  "src/components/audio/AudioFeedCard.tsx",
  "src/components/audio/ProfileAudioSections.tsx",
  "src/components/audio/CommunityAudioView.tsx",
  "src/components/audio/RadioPanel.tsx",
  "src/components/audio/PodcastEpisodeDetail.tsx",
  "src/services/audio/audioDataSource.ts",
  "src/services/audio/radioService.ts",
  "src/services/audio/podcastService.ts",
  "src/services/audio/audioPlayerService.ts",
  "supabase/migrations/20260710251000_audio_radio_podcast_schema_rls.sql",
  "docs/audio-supabase-schema.md",
];

const files = new Map(await Promise.all(paths.map(async (path) => [path, await read(path)])));
const combined = [...files.values()].join("\n");

for (const type of ["RadioSession", "PodcastEpisode", "AudioFeedItem", "AudioPlayableItem"]) {
  if (!files.get("src/types/audio.ts")?.includes(type)) throw new Error(`Missing audio domain type: ${type}`);
}

const mock = files.get("src/data/mockAudio.ts") ?? "";
if ((mock.match(/id: "radio-/g) ?? []).length < 6) throw new Error("Radio mock coverage is below six sessions");
if ((mock.match(/id: "podcast-/g) ?? []).length < 10) throw new Error("Podcast mock coverage is below ten episodes");
if (/audioUrl:\s*["']https?:\/\//i.test(mock)) throw new Error("Mock audio includes an external media URL");

for (const component of ["AudioPlayer", "AudioMiniPlayer", "AudioFeedCard", "ProfileAudioSections", "CommunityAudioView", "RadioPanel", "PodcastEpisodeDetail"]) {
  if (!combined.includes(`function ${component}`)) throw new Error(`Missing audio UI component: ${component}`);
}

const source = files.get("src/services/audio/audioDataSource.ts") ?? "";
if (!source.includes("dataSourceService.getStatus().isMock") || !source.includes("getSupabaseClient")) {
  throw new Error("Audio service layer does not support both data-source modes");
}
if (/service[_-]?role|sb_secret_|password\s*=/i.test(source)) throw new Error("Audio service layer contains a secret-like value");

const migration = files.get("supabase/migrations/20260710251000_audio_radio_podcast_schema_rls.sql") ?? "";
if ((migration.match(/enable row level security/g) ?? []).length < 6) throw new Error("Audio RLS coverage is incomplete");
if (!migration.includes("'podcast-audio', 'podcast-audio', false") || !migration.includes("'audio-covers', 'audio-covers', false")) {
  throw new Error("Audio storage buckets are not private");
}

if (/discord/i.test(combined)) throw new Error("Audio MVP includes prohibited Discord branding");
if (/dangerouslySetInnerHTML|autoPlay/i.test(combined)) throw new Error("Audio MVP includes unsafe rendering or autoplay");

console.log("Audio MVP final QA passed: domain, mock data, UI surfaces, services, RLS, private storage, and media safety.");
