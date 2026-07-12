import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260712164500_v1_voice_permission_matrix.sql");
const edge = read("supabase/functions/livekit-moderation/index.ts");
const token = read("supabase/functions/livekit-token/index.ts");
const ui = read("src/components/VoiceRoomView.tsx");
const hosted = read("scripts/v1-voice-permissions-hosted-validation.mjs");

for (const permission of ["viewVoiceRoom", "joinVoiceRoom", "publishAudio", "shareScreen", "muteMembers", "removeFromVoice", "manageVoiceRoom"]) {
  if (!migration.includes(permission)) throw new Error(`Missing canonical server permission: ${permission}`);
}
if (!migration.includes("list_visible_voice_rooms") || !migration.includes("channel.type<>'voice'")) throw new Error("Voice discovery privacy enforcement is missing.");
if (!migration.includes("community_member_roles") || !migration.includes("community_user_max_role_level") || !migration.includes("VOICE_ROLE_HIERARCHY_DENIED")) throw new Error("Multi-role Voice hierarchy enforcement is missing.");
if (!migration.includes("community_bans") || !migration.includes("community_member_timeouts") || !migration.includes("viewPrivateChannels")) throw new Error("Ban, timeout, or private Voice denial is missing.");
if (!edge.includes("RoomServiceClient") || !edge.includes("record_livekit_voice_moderation")) throw new Error("Provider moderation or audit recording is missing.");
if (!token.includes("canPublishAudio") || !token.includes("canPublishScreen")) throw new Error("Token capability response is incomplete.");
if (!ui.includes("canMuteMembers") || !ui.includes("canRemoveFromVoice")) throw new Error("Voice moderation UI gates are missing.");
for(const actor of ["owner","admin","moderator","member","visitor","blocked","unauthorized"])if(!hosted.includes(`"${actor}"`))throw new Error(`Hosted role fixture missing: ${actor}`);
console.log("V1 Voice and Screen permission structural smoke passed.");
