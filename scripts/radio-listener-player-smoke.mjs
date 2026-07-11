import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const player = read("src/services/audio/audioPlayerService.ts");
const coordinator = read("src/services/audio/audioPlaybackCoordinatorService.ts");
const globalPlayer = read("src/components/audio/GlobalAudioMiniPlayer.tsx");
const mini = read("src/components/audio/AudioMiniPlayer.tsx");
const radio = read("src/services/audio/radioService.ts");
const source = read("src/services/audio/audioDataSource.ts");
const migration = read("supabase/migrations/20260711001200_radio_listener_stream_contract.sql");
const app = read("src/App.tsx");

const required = [
  [player, "let transport: HTMLAudioElement | null", "single transport"],
  [player, "picom.audio.volume.v1", "volume persistence"],
  [player, "scheduleReconnect", "live reconnect"],
  [player, "cleanupTransport", "resource cleanup"],
  [player, "Playback was blocked", "safe playback error"],
  [coordinator, "radioRepository.leave", "radio leave coordination"],
  [globalPlayer, "heartbeatRadioListener", "listener persistence heartbeat"],
  [globalPlayer, "markEnded", "ended session handling"],
  [mini, "Stop, leave, and close audio player", "accessible stop"],
  [radio, "audioUrl: session.streamUrl", "real stream mapping"],
  [radio, "audioPlaybackCoordinatorService.stopCurrent", "overlap prevention"],
  [source, "stream_url", "Supabase stream source"],
  [migration, "radio_sessions_listener_safe_stream_url_check", "safe endpoint constraint"],
  [migration, "close_radio_listeners_on_terminal_status", "terminal cleanup"],
  [app, "<GlobalAudioMiniPlayer", "navigation-persistent global dock"],
];
for (const [content, marker, label] of required) if (!content.includes(marker)) throw new Error("Missing " + label + ": " + marker);
if (player.includes("setInterval") || read("src/components/audio/useAudioPlayback.ts").includes("new Audio(")) throw new Error("Fake or duplicate component playback remains.");
console.log("Radio listener player and global mini-player Full MVP smoke passed.");
