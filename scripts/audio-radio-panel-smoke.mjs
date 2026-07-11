import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [panel, communityView, feed, globalPlayer, radioService] = await Promise.all([read("src/components/audio/RadioPanel.tsx"), read("src/components/audio/CommunityAudioView.tsx"), read("src/components/MentionFeedMain.tsx"), read("src/components/audio/GlobalAudioMiniPlayer.tsx"), read("src/services/audio/radioService.ts")]);
for (const name of ["RadioPanel", "RadioNowLiveHeader", "RadioHostCard", "RadioListenerList", "RadioControls", "RadioScheduleCard", "RadioChatLink"]) {
  if (!panel.includes(`function ${name}`)) throw new Error(`Missing ${name}`);
}
if (!panel.includes("Stop listening") || !panel.includes("useAudioPlayer") || panel.includes("setListening")) throw new Error("Global Radio listening state is incomplete");
if (!panel.includes("canHost ?") || !panel.includes("Start broadcast")) throw new Error("Host permission controls are incomplete");
if (!globalPlayer.includes("AudioMiniPlayer") || !radioService.includes("listenToRadio") || !radioService.includes("leaveRadio")) throw new Error("Global Radio mini-player integration is missing");
if (!communityView.includes("selectedRadioSession") || !communityView.includes("<RadioPanel")) throw new Error("Community radio panel entry is missing");
if (!feed.includes("selectedRadioSessionId") || !feed.includes("<RadioPanel")) throw new Error("Mention Feed radio panel entry is missing");
if (panel.includes("supabase") || panel.includes("LiveKit") || panel.includes("autoPlay")) throw new Error("Radio panel must stay local and explicit-play");
console.log("Radio panel global state, permissions, feed entry, and persistent mini-player smoke passed.");
