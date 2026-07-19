import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260711150600_voice_screen_permissions_moderation.sql");
const edge = read("supabase/functions/livekit-moderation/index.ts");
const token = read("supabase/functions/livekit-token/index.ts");
const ui = read("src/components/VoiceRoomView.tsx");

for (const permission of ["joinVoice", "speak", "shareScreen", "muteMembers", "removeFromVoice", "manageVoiceRoom"]) {
  if (!migration.includes(permission)) throw new Error(`Missing server permission: ${permission}`);
}
if (!migration.includes("community_voice_rooms_enabled") || !migration.includes("VOICE_ROLE_HIERARCHY_DENIED")) throw new Error("Voice configuration or hierarchy enforcement is missing.");
if (!migration.includes("viewRadioContent") || !migration.includes("viewPodcastContent")) throw new Error("Community-kind read boundaries are missing.");
if (!edge.includes("RoomServiceClient") || !edge.includes("record_livekit_voice_moderation")) throw new Error("Provider moderation or audit recording is missing.");
if (!token.includes("canPublishAudio") || !token.includes("canPublishScreen")) throw new Error("Token capability response is incomplete.");
if (!ui.includes("canMuteMembers") || !ui.includes("canRemoveFromVoice")) throw new Error("Voice moderation UI gates are missing.");
console.log("Voice and screen permission structural smoke passed.");
