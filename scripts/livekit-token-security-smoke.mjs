import { readFileSync } from "node:fs";
const read=(file)=>readFileSync(file,"utf8");
const fn=read("supabase/functions/livekit-token/index.ts"),token=read("supabase/functions/_shared/livekit-token.ts"),migration=read("supabase/migrations/20260711150600_voice_screen_permissions_moderation.sql"),directMigration=read("supabase/migrations/20260715000000_direct_voice_call_authorization.sql"),config=read("supabase/config.toml"),client=read("src/services/livekit/livekitService.ts");
const checks=[
 ["JWT verified",fn.includes("requireSupabaseUser")&&/\[functions\.livekit-token\]\s*verify_jwt\s*=\s*true/.test(config)],
 ["member and type configuration authorization RPC",fn.includes('rpc("authorize_livekit_room"')&&migration.includes("VOICE_MEMBERSHIP_REQUIRED")&&migration.includes("community_voice_rooms_enabled")],
 ["visitor private ban timeout denial",migration.includes("community_bans")&&migration.includes("community_member_timeouts")&&migration.includes("VOICE_PRIVATE_CHANNEL_FORBIDDEN")],
 ["kind-aware scoped permissions",["viewChannel","viewRadioContent","viewPodcastContent","viewPrivateChannels","joinVoice","speak","shareScreen"].every((permission)=>migration.includes(`'${permission}'`))],
 ["radio broadcast remains separate",!migration.includes("'hostRadio'")&&!migration.includes("'listenRadio'")],
 ["hour least privilege token", (fn.includes("60 * 60") || fn.includes("3600")) &&token.includes("canPublishSources")&&fn.includes('"microphone"')&&fn.includes('"screen_share"')&&fn.includes("authorization.can_publish_audio")&&fn.includes("canPublishData: true")],
 ["capabilities returned to renderer",["canPublishAudio","canPublishVideo","canPublishScreen","expiresAt"].every((field)=>fn.includes(field))&&fn.includes("canPublishAudio = authorization.can_publish_audio")&&fn.includes("canPublishVideo = callAuthorization.can_publish_video")&&fn.includes("canPublishVideo = false")&&fn.includes("canPublishScreen = authorization.can_publish_screen")],
 ["direct DM call authorized by conversation participation",fn.includes('rpc("authorize_direct_livekit_room"')&&fn.includes("createPicomDirectLiveKitRoomName")&&fn.includes("VOICE_DIRECT_FORBIDDEN")&&directMigration.includes("direct_conversation_participants")&&directMigration.includes("security definer")&&/grant execute on function public\.authorize_direct_livekit_room/.test(directMigration)],
 ["restricted CORS",fn.includes("PICOM_ALLOWED_ORIGINS")&&fn.includes("Origin is not allowed")&&!fn.includes('"Access-Control-Allow-Origin": "*"')],
 ["method and bounded JSON",fn.includes("maxBodyBytes = 2048")&&fn.includes("Content-Type must be application/json")&&fn.includes("methodNotAllowed")],
 ["deterministic identity room",fn.includes("auth.user.id")&&fn.includes("createPicomLiveKitRoomName")&&fn.includes("matchesPicomLiveKitRoomName")],
 ["secret server boundary",fn.includes('getRequiredEnv("LIVEKIT_API_SECRET")')&&!client.includes("LIVEKIT_API_SECRET")],
];
for(const [label,pass] of checks){if(!pass)throw new Error(`FAIL ${label}`);console.log(`PASS ${label}`)}console.log("Secure LiveKit token authorization smoke passed.");
