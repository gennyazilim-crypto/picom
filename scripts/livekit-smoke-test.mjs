import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const voiceService = readFileSync(resolve(root, "src/services/voiceService.ts"), "utf8");
const livekitService = readFileSync(resolve(root, "src/services/livekit/livekitService.ts"), "utf8");
const livekitTypes = readFileSync(resolve(root, "src/services/livekit/livekitTypes.ts"), "utf8");
const livekitFunction = readFileSync(resolve(root, "supabase/functions/livekit-token/index.ts"), "utf8");
const livekitTokenHelper = readFileSync(resolve(root, "supabase/functions/_shared/livekit-token.ts"), "utf8");
const screenCaptureService = readFileSync(resolve(root, "src/services/screenCaptureService.ts"), "utf8");
const electronMain = readFileSync(resolve(root, "electron/main.cts"), "utf8");
const preload = readFileSync(resolve(root, "electron/preload.cts"), "utf8");

if (!packageJson.dependencies?.["livekit-client"]) {
  throw new Error("Missing livekit-client dependency.");
}

const voiceRequired = [
  "Room",
  "RoomEvent",
  "Track.Source.ScreenShare",
  "VOICE_TOKEN_FAILED",
  "VOICE_SCREEN_SHARE_FAILED",
  "startScreenShare",
  "stopScreenShare",
  "setMuted",
  "setDeafened"
];

for (const term of voiceRequired) {
  if (!voiceService.includes(term)) {
    throw new Error(`Missing voice service LiveKit wiring: ${term}`);
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

const typeRequired = ["LiveKitIntent", "LiveKitTokenRequest", "LiveKitTokenResponse"];
for (const term of typeRequired) {
  if (!livekitTypes.includes(term)) {
    throw new Error(`Missing LiveKit type: ${term}`);
  }
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

console.log("✓ LiveKit dependency and renderer service");
console.log("✓ Supabase LiveKit token Edge Function");
console.log("✓ Electron screen share bridge");
console.log("✓ LiveKit smoke test completed");
