import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const memberAccess = read("supabase/migrations/20260712166000_active_member_voice_screen_access.sql");
const moderation = read("supabase/migrations/20260712164500_v1_voice_permission_matrix.sql");
const edge = read("supabase/functions/livekit-moderation/index.ts");
const token = read("supabase/functions/livekit-token/index.ts");
const ui = read("src/App.tsx");
const permissions = read("src/services/permissions/communityPermissions.ts");
const hosted = read("scripts/v1-voice-permissions-hosted-validation.mjs");

const ordinarySection = memberAccess.slice(
  memberAccess.indexOf("create or replace function public.can_view_channel"),
  memberAccess.indexOf("revoke all on function public.is_active_community_media_member"),
);

for (const required of [
  "is_active_community_media_member",
  "community_members",
  "community_bans",
  "community_member_timeouts",
  "deletion_requested_at",
  "list_visible_voice_rooms",
  "authorize_livekit_room",
]) {
  if (!memberAccess.includes(required)) throw new Error(`Active-member media gate missing: ${required}`);
}
for (const forbidden of ["effective_community_permission", "viewPrivateChannels", "community.kind='text'"]) {
  if (ordinarySection.includes(forbidden)) throw new Error(`Ordinary member media access still depends on ${forbidden}.`);
}
if (!ordinarySection.includes("target_channel.is_private") || !ordinarySection.includes("true,\n    true")) {
  throw new Error("Private Voice access or unconditional ordinary publishing grants are missing.");
}
if (!moderation.includes("authorize_livekit_voice_moderation") || !moderation.includes("VOICE_ROLE_HIERARCHY_DENIED") || !moderation.includes("effective_community_permission")) {
  throw new Error("Role-aware Voice moderation hierarchy was weakened or removed.");
}
if (!edge.includes("RoomServiceClient") || !edge.includes("record_livekit_voice_moderation")) throw new Error("Provider moderation or audit recording is missing.");
if (!token.includes("canPublishAudio") || !token.includes("canPublishScreen")) throw new Error("Token capability response is incomplete.");
if (!permissions.includes("isActiveCommunityMember") || !permissions.includes("isOrdinaryCommunityMediaPermission") || !permissions.includes("return access.isActiveMember")) {
  throw new Error("Frontend ordinary media authorization is not membership-based.");
}
for (const staleGate of ["permissions.includes(\"joinVoiceRoom\")", "permissions.includes(\"publishAudio\")", "permissions.includes(\"shareScreen\")"]) {
  if (ui.includes(staleGate)) throw new Error(`Renderer still applies a role-based ordinary media gate: ${staleGate}`);
}
if (!ui.includes("communityAccess.isActiveMember")) throw new Error("Renderer active-member Voice gate is missing.");
for (const actor of ["owner", "admin", "moderator", "member", "roleless_member", "visitor", "blocked", "unauthorized"]) {
  if (!hosted.includes(`\"${actor}\"`)) throw new Error(`Hosted membership fixture missing: ${actor}`);
}
if (!hosted.includes('["owner","admin","moderator","member","roleless_member"]')) {
  throw new Error("Hosted private Voice matrix does not grant every active member.");
}

console.log("Active-member Voice and Screen access structural smoke passed; moderation remains role-aware.");
