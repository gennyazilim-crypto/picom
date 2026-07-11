import { readFileSync } from "node:fs";

const files = ["AudioPlayer", "AudioMiniPlayer", "AudioProgressBar", "AudioVolumeControl", "AudioPlaybackButton", "AudioNowPlayingCard", "GlobalAudioMiniPlayer"];
for (const file of files) if (!readFileSync("src/components/audio/" + file + ".tsx", "utf8").includes("function " + file)) throw new Error("Missing audio component: " + file);
const service = readFileSync("src/services/audio/audioPlayerService.ts", "utf8");
const hook = readFileSync("src/components/audio/useAudioPlayback.ts", "utf8");
if (!service.includes("let transport: HTMLAudioElement | null") || !service.includes("new Audio(source)")) throw new Error("Single HTMLAudioElement transport is missing.");
if (!service.includes("picom.audio.volume.v1") || !service.includes("localStorage")) throw new Error("Safe volume persistence is missing.");
if (!service.includes("scheduleReconnect") || !service.includes("cleanupTransport")) throw new Error("Reconnect or transport cleanup is incomplete.");
if (hook.includes("new Audio(") || hook.includes("setInterval")) throw new Error("Component hook must not create or simulate independent playback.");
if (/autoPlay|\.play\(\).*useEffect/.test(hook)) throw new Error("Audio must never autoplay.");
console.log("Audio player global transport, explicit action, reconnect, persistence, and cleanup smoke passed.");
