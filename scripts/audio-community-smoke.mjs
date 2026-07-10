import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [view, sidebar, app] = await Promise.all([read("src/components/audio/CommunityAudioView.tsx"), read("src/components/CommunitySidebar.tsx"), read("src/App.tsx")]);
for (const name of ["CommunityAudioView", "CommunityAudioHeader", "CommunityAudioCard", "CommunityRadioSection", "CommunityPodcastSection", "RadioSessionList", "PodcastEpisodeList"]) {
  if (!view.includes(`function ${name}`)) throw new Error(`Missing ${name}`);
}
if (!view.includes('"live" | "podcasts" | "scheduled"')) throw new Error("Community audio tabs are incomplete");
if (!sidebar.includes("community-audio-entry") || !sidebar.includes("onOpenAudio")) throw new Error("Sidebar audio entry is missing");
if (!app.includes('"communityAudio"') || !app.includes("<CommunityAudioView")) throw new Error("App view integration is missing");
if (view.includes("supabase.from") || view.includes("autoPlay")) throw new Error("Community audio must remain mock-only and explicit-play");
console.log("Community audio smoke passed.");
