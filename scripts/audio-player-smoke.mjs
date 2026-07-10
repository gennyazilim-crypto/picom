import { readFileSync } from "node:fs";

const files = ["AudioPlayer", "AudioMiniPlayer", "AudioProgressBar", "AudioVolumeControl", "AudioPlaybackButton", "AudioNowPlayingCard"];
for (const file of files) if (!readFileSync(`src/components/audio/${file}.tsx`, "utf8").includes(`function ${file}`)) throw new Error(`Missing audio component: ${file}`);
const hook = readFileSync("src/components/audio/useAudioPlayback.ts", "utf8");
if (!hook.includes("new Audio(item.audioUrl)") || !hook.includes("togglePlayback")) throw new Error("Explicit HTMLAudioElement playback path is missing.");
if (/autoPlay|\.play\(\).*useEffect/.test(hook)) throw new Error("Audio must never autoplay.");
if (!hook.includes("window.clearInterval") || !hook.includes("audio.pause()")) throw new Error("Audio/timer cleanup is incomplete.");
console.log("Audio player explicit-action, simulation, and cleanup smoke passed.");
