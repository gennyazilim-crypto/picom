import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const appShell = readFileSync(resolve(root, "src/App.tsx"), "utf8");
const voiceService = readFileSync(resolve(root, "src/services/voiceService.ts"), "utf8");
const voiceRoomView = readFileSync(resolve(root, "src/components/VoiceRoomView.tsx"), "utf8");
const screenSourcePicker = readFileSync(resolve(root, "src/components/voice/ScreenSourcePicker.tsx"), "utf8");
const screenShareControls = readFileSync(resolve(root, "src/components/voice/ScreenShareControls.tsx"), "utf8");
const screenSharePreview = readFileSync(resolve(root, "src/components/voice/ScreenSharePreview.tsx"), "utf8");
const livekitService = readFileSync(resolve(root, "src/services/livekit/livekitService.ts"), "utf8");
const voiceRoomService = readFileSync(resolve(root, "src/services/livekit/voiceRoomService.ts"), "utf8");
const livekitTypes = readFileSync(resolve(root, "src/services/livekit/livekitTypes.ts"), "utf8");
const roomNaming = readFileSync(resolve(root, "src/services/voiceRoomNaming.ts"), "utf8");
const livekitFunction = readFileSync(resolve(root, "supabase/functions/livekit-token/index.ts"), "utf8");
const livekitTokenHelper = readFileSync(resolve(root, "supabase/functions/_shared/livekit-token.ts"), "utf8");
const edgeRoomNaming = readFileSync(resolve(root, "supabase/functions/_shared/livekit-room.ts"), "utf8");
const screenCaptureService = readFileSync(resolve(root, "src/services/screenCaptureService.ts"), "utf8");
const screenShareService = readFileSync(resolve(root, "src/services/desktop/screenShareService.ts"), "utf8");
const electronMain = readFileSync(resolve(root, "electron/main.cts"), "utf8");
const preload = readFileSync(resolve(root, "electron/preload.cts"), "utf8");
const ipcChannels = readFileSync(resolve(root, "electron/ipcChannels.cts"), "utf8");

if (!packageJson.dependencies?.["livekit-client"]) {
  throw new Error("Missing livekit-client dependency.");
}

const voiceRequired = [
  "Room",
  "RoomEvent",
  "VOICE_TOKEN_FAILED",
  "errorCode",
  "getDiagnosticsSummary",
  "VoiceSessionDiagnosticsSummary",
  "Picom could not connect to this voice room",
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
  "Disconnect",
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
  "authorize_livekit_room",
  "PICOM_ALLOWED_ORIGINS",
  "createLiveKitToken"
];

for (const term of functionRequired) {
  if (!livekitFunction.includes(term)) {
    throw new Error(`Missing Edge Function LiveKit wiring: ${term}`);
  }
}

const tokenHelperRequired = ["HMAC", "SHA-256", "roomJoin", "canPublish", "canSubscribe", "canPublishSources"];
for (const term of tokenHelperRequired) {
  if (!livekitTokenHelper.includes(term)) {
    throw new Error(`Missing LiveKit token helper capability: ${term}`);
  }
}

const screenCaptureRequired = ["window.picomDesktop?.screenCapture?.getSources", "selectSource", "cancelSelection", "SCREEN_CAPTURE_UNAVAILABLE"];
for (const term of screenCaptureRequired) {
  if (!screenCaptureService.includes(term)) {
    throw new Error(`Missing screen capture service wiring: ${term}`);
  }
}

const screenShareRequired = [
  [screenSourcePicker, "ScreenSharePicker", "ScreenSourcePicker wrapper"],
  [screenShareControls, "ScreenSharePicker", "ScreenShareControls wrapper"],
  [screenSharePreview, "ScreenShareViewer", "ScreenSharePreview wrapper"],
  [screenShareService, "screenCaptureService.listSources", "desktop screenShareService source listing"],
  [voiceRoomView, "ScreenShareControls", "VoiceRoomView screen-share controls"],
  [voiceRoomView, "VoiceParticipantScreenShare", "VoiceRoomView screen-share preview"],
  [voiceService, "publishTrack", "LiveKit publish screen track"],
  [voiceService, "unpublishTrack", "LiveKit unpublish screen track"]
];

for (const [contents, term, label] of screenShareRequired) {
  if (!contents.includes(term)) {
    throw new Error(`Missing screen share MVP wiring: ${label}`);
  }
}

if (!electronMain.includes("desktopCapturer.getSources") || !preload.includes("screenCapture")) {
  throw new Error("Missing Electron screen capture bridge.");
}

if (!ipcChannels.includes("picom:screen-capture-get-sources") || !ipcChannels.includes("picom:screen-capture-select-source") || !ipcChannels.includes("picom:screen-capture-cancel-selection") || !preload.includes("invokeWhitelisted")) {
  throw new Error("Screen capture IPC must stay whitelisted through preload.");
}

console.log("OK LiveKit dependency and renderer service");
console.log("OK LiveKit VoiceRoomView UI wiring");
console.log("OK deterministic LiveKit voice room naming");
console.log("OK Supabase LiveKit token Edge Function");
console.log("OK Electron screen share bridge");
console.log("OK Screen share MVP controls and preview");
console.log("OK standardized voice errors and diagnostics summary");
console.log("OK LiveKit smoke test completed");
