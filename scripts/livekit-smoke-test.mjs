import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const appShell = readFileSync(resolve(root, "src/App.tsx"), "utf8");
const voiceService = readFileSync(resolve(root, "src/services/voiceService.ts"), "utf8");
const voiceRoomView = readFileSync(resolve(root, "src/components/VoiceRoomView.tsx"), "utf8");
const livekitService = readFileSync(resolve(root, "src/services/livekit/livekitService.ts"), "utf8");
const voiceRoomService = readFileSync(resolve(root, "src/services/livekit/voiceRoomService.ts"), "utf8");
const livekitTypes = readFileSync(resolve(root, "src/services/livekit/livekitTypes.ts"), "utf8");
const roomNaming = readFileSync(resolve(root, "src/services/voiceRoomNaming.ts"), "utf8");
const livekitFunction = readFileSync(resolve(root, "supabase/functions/livekit-token/index.ts"), "utf8");
const livekitTokenHelper = readFileSync(resolve(root, "supabase/functions/_shared/livekit-token.ts"), "utf8");
const edgeRoomNaming = readFileSync(resolve(root, "supabase/functions/_shared/livekit-room.ts"), "utf8");
const screenCaptureService = readFileSync(resolve(root, "src/services/screenCaptureService.ts"), "utf8");
const electronMain = readFileSync(resolve(root, "electron/main.cts"), "utf8");
const preload = readFileSync(resolve(root, "electron/preload.cts"), "utf8");

if (!packageJson.dependencies?.["livekit-client"]) {
  throw new Error("Missing livekit-client dependency.");
}

const voiceRequired = [
  "Room",
  "RoomEvent",
  "VOICE_TOKEN_FAILED",
  "setMuted",
  "setDeafened",
  "ActiveSpeakersChanged",
  "ParticipantConnected",
  "ParticipantDisconnected"
];

for (const term of voiceRequired) {
  if (!voiceService.includes(term)) {
    throw new Error(`Missing voice service LiveKit wiring: ${term}`);
  }
}

const voiceViewRequired = [
  "VoiceConnectionStatus",
  "VoiceControls",
  "VoiceParticipantList",
  "SpeakingIndicator",
  "Join room",
  "Leave room",
  "Mute",
  "Deafen"
];

for (const term of voiceViewRequired) {
  if (!voiceRoomView.includes(term)) {
    throw new Error(`Missing VoiceRoomView MVP UI wiring: ${term}`);
  }
}

const clientRequired = [
  "supabase.functions",
  "invoke<LiveKitTokenResponse>",
  "livekit-token",
  "LIVEKIT_INVALID_TOKEN_RESPONSE",
  "createPicomLiveKitRoomName"
];

for (const term of clientRequired) {
  if (!livekitService.includes(term)) {
    throw new Error(`Missing renderer LiveKit token wiring: ${term}`);
  }
}

if (!voiceRoomService.includes("voiceService")) {
  throw new Error("Missing LiveKit voiceRoomService namespace.");
}

const typeRequired = ["LiveKitIntent", "LiveKitTokenRequest", "LiveKitTokenResponse"];
for (const term of typeRequired) {
  if (!livekitTypes.includes(term)) {
    throw new Error(`Missing LiveKit type: ${term}`);
  }
}

if (!roomNaming.includes(":voice:${channelId}") || !edgeRoomNaming.includes(":voice:${channelId}")) {
  throw new Error("LiveKit room naming must use community:{communityId}:voice:{channelId} format.");
}

if (!appShell.includes("VoiceRoomView") || !appShell.includes("displayedActiveChannel.type === \"voice\"")) {
  throw new Error("Voice channels are not wired to VoiceRoomView in App.");
}

const functionRequired = [
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "requireSupabaseUser",
  "VOICE_NOT_CONFIGURED",
  "VOICE_CHANNEL_FORBIDDEN",
  "VOICE_CHANNEL_REQUIRED",
  "createLiveKitToken"
];

for (const term of functionRequired) {
  if (!livekitFunction.includes(term)) {
    throw new Error(`Missing Edge Function LiveKit wiring: ${term}`);
  }
}

const tokenHelperRequired = ["HMAC", "SHA-256", "roomJoin", "canPublish", "canSubscribe"];
for (const term of tokenHelperRequired) {
  if (!livekitTokenHelper.includes(term)) {
    throw new Error(`Missing LiveKit token helper capability: ${term}`);
  }
}

const screenCaptureRequired = ["window.picomDesktop?.screenCapture?.getSources", "SCREEN_CAPTURE_UNAVAILABLE"];
for (const term of screenCaptureRequired) {
  if (!screenCaptureService.includes(term)) {
    throw new Error(`Missing screen capture service wiring: ${term}`);
  }
}

if (!electronMain.includes("desktopCapturer.getSources") || !preload.includes("screenCapture")) {
  throw new Error("Missing Electron screen capture bridge.");
}

console.log("OK LiveKit dependency and renderer service");
console.log("OK LiveKit VoiceRoomView UI wiring");
console.log("OK deterministic LiveKit voice room naming");
console.log("OK Supabase LiveKit token Edge Function");
console.log("OK Electron screen share bridge");
console.log("OK LiveKit smoke test completed");
