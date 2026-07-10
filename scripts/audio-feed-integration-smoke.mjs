import { readFileSync } from "node:fs";

const main = readFileSync("src/components/MentionFeedMain.tsx", "utf8");
const rail = readFileSync("src/components/FeedCompanionRail.tsx", "utf8");
const card = readFileSync("src/components/audio/AudioFeedCard.tsx", "utf8");
for (const marker of ["AudioFeedSection", "mockAudioFeedItems", "selectedAudio", "savedAudioIds", "audioReminderIds"]) if (!main.includes(marker)) throw new Error(`Mention Feed audio integration missing: ${marker}`);
if (!rail.includes("AudioMiniPlayer") || !rail.includes("audioItem")) throw new Error("Feed Companion Rail mini player integration is missing.");
for (const marker of ["Live now", "Scheduled radio", "Podcast episode", "Open community"]) if (!card.includes(marker)) throw new Error(`Audio feed card state missing: ${marker}`);
if (/autoPlay|supabase\.from/.test(`${main}${rail}${card}`)) throw new Error("Feed audio integration must not autoplay or query Supabase directly.");
console.log("Mention Feed radio/podcast cards and mini player integration smoke passed.");
