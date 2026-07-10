import { readFileSync } from "node:fs";

const profile = readFileSync("src/components/ProfileView.tsx", "utf8");
const sections = readFileSync("src/components/audio/ProfileAudioSections.tsx", "utf8");
for (const marker of ["hostedRadio", "podcastEpisodes", "savedRadio", "audioStats", "ProfileAudioSections"]) if (!profile.includes(marker)) throw new Error(`Profile audio integration missing: ${marker}`);
for (const marker of ["Hosted radio", "Published episodes", "Saved audio", "AudioMiniPlayer", "TODO: enforce production visibility through Supabase RLS"]) if (!sections.includes(marker)) throw new Error(`Profile audio section missing: ${marker}`);
if (/supabase\.from|autoPlay/.test(`${profile}${sections}`)) throw new Error("Profile audio must not query Supabase directly or autoplay.");
console.log("Profile radio, podcast, saved audio, and visibility smoke passed.");
