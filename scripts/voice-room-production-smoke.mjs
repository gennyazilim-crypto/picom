import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");

const view = read("src/components/VoiceRoomView.tsx");
const chat = read("src/components/voice/VoiceRoomChatPanel.tsx");
const app = read("src/App.tsx");
const voiceService = read("src/services/voiceService.ts");
const tokenFn = read("supabase/functions/livekit-token/index.ts");
const occupancyFn = read("supabase/functions/voice-occupancy/index.ts");
const authorizeFn = read("supabase/functions/voice-call-authorize/index.ts");
const inviteService = read("src/services/voice/voiceCallInviteService.ts");
const occupancyService = read("src/services/voice/voiceOccupancyService.ts");
const manifest = read("supabase/functions/release-manifest.json");

const checks = [
  ["Activities stub removed", !view.includes("Choose activity")],
  ["Real session timer", view.includes("formatSessionElapsed") && view.includes("connectedAt")],
  ["Chat more menu actions", chat.includes("Scroll to latest") && chat.includes("Copy channel ID") && chat.includes("Mute channel notifications")],
  ["Friends label polished", app.includes('label: "Open friends"') && !app.includes("Open friends foundation")],
  ["Community camera gated on token", app.includes("canUseVoiceCamera={Boolean(voiceSnapshot.canUseCamera)")],
  ["Token TTL is one hour", tokenFn.includes("60 * 60") || /ttlSeconds:\s*3600/.test(tokenFn) || /tokenTtlSeconds\s*=\s*60\s*\*\s*60/.test(tokenFn)],
  ["Silent token refresh scheduled", voiceService.includes("scheduleTokenRefresh") && voiceService.includes("TOKEN_REFRESH_LEAD_MS") && voiceService.includes("refreshActiveSessionToken")],
  ["Silent refresh avoids connecting toast", voiceService.includes('status: options.silent ? "reconnecting" : "connecting"')],
  ["voice-occupancy edge function", occupancyFn.includes("listParticipants") && occupancyFn.includes('rpc("authorize_livekit_room"')],
  ["voice occupancy client", occupancyService.includes('functions.invoke') && occupancyService.includes('"voice-occupancy"')],
  ["App occupancy poll", app.includes("voiceOccupancyService") && app.includes("10_000")],
  ["voice-call-authorize edge function", authorizeFn.includes("VOICE_INVITE_FORBIDDEN") && authorizeFn.includes("consume_current_user_action_rate_limit") && authorizeFn.includes("direct_conversation_participants")],
  ["Invite authorize before broadcast", inviteService.includes('"voice-call-authorize"') && inviteService.includes("authorizeBody")],
  ["Manifest entries", manifest.includes('"voice-occupancy"') && manifest.includes('"voice-call-authorize"')],
];

const failures = checks.filter(([, ok]) => !ok).map(([label]) => label);
if (failures.length) {
  console.error(`Voice room production smoke failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Voice room production smoke passed (${checks.length} checks).`);
