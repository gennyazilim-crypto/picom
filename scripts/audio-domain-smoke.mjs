import { readFileSync } from "node:fs";

const types = readFileSync("src/types/audio.ts", "utf8");
const mock = readFileSync("src/data/mockAudio.ts", "utf8");
for (const marker of ["AudioContentType", "RadioSession", "PodcastEpisode", "AudioReactionSummary", "AudioCommentPreview", "AudioFeedItem"]) if (!types.includes(marker)) throw new Error(`Missing audio domain type: ${marker}`);
for (const marker of ["mockRadioSessions", "mockPodcastEpisodes", "mockAudioFeedItems", "makeAudioCover"]) if (!mock.includes(marker)) throw new Error(`Missing mock audio foundation: ${marker}`);
if (/(?:audioUrl|coverUrl):\s*["']https?:\/\//.test(mock)) throw new Error("Mock audio must not use external copyrighted media URLs.");
if ((mock.match(/status: "live"/g) ?? []).length < 2 || (mock.match(/status: "scheduled"/g) ?? []).length < 2 || (mock.match(/status: "ended"/g) ?? []).length < 2) throw new Error("Radio status coverage is incomplete.");
if ((mock.match(/id: "podcast-/g) ?? []).length < 10) throw new Error("At least ten podcast episodes are required.");
console.log("Audio domain and safe mock media smoke passed.");
