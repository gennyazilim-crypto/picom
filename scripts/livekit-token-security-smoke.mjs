import { readFileSync } from "node:fs";
const read=(file)=>readFileSync(file,"utf8");
const fn=read("supabase/functions/livekit-token/index.ts"),token=read("supabase/functions/_shared/livekit-token.ts"),migration=read("supabase/migrations/20260711150600_voice_screen_permissions_moderation.sql"),config=read("supabase/config.toml"),client=read("src/services/livekit/livekitService.ts"),staging=read("scripts/livekit-token-staging-validation.mjs"),deploy=read("scripts/deploy-livekit-token-staging.mjs");
const checks=[
 ["JWT verified",fn.includes("requireSupabaseUser")&&/\[functions\.livekit-token\]\s*verify_jwt\s*=\s*true/.test(config)],
 ["canonical active human profile",fn.includes('.from("profiles")')&&fn.includes("deletion_requested_at")&&fn.includes("profile.is_bot")&&fn.includes("canonicalParticipantName")&&!fn.includes("user_metadata")],
 ["server-side V1 release gate",fn.includes('PICOM_V1_VOICE_SCREEN_ENABLED')&&fn.includes("isV1VoiceScreenEnabled")],
 ["member and type configuration authorization RPC",fn.includes('rpc("authorize_livekit_room"')&&migration.includes("VOICE_MEMBERSHIP_REQUIRED")&&migration.includes("community_voice_rooms_enabled")],
 ["visitor private ban timeout denial",migration.includes("community_bans")&&migration.includes("community_member_timeouts")&&migration.includes("VOICE_PRIVATE_CHANNEL_FORBIDDEN")],
 ["kind-aware scoped permissions",["viewChannel","viewRadioContent","viewPodcastContent","viewPrivateChannels","joinVoice","speak","shareScreen"].every((permission)=>migration.includes(`'${permission}'`))],
 ["radio broadcast remains separate",!migration.includes("'hostRadio'")&&!migration.includes("'listenRadio'")],
 ["short least privilege token",fn.includes("10 * 60")&&token.includes("canPublishSources")&&fn.includes('"microphone"')&&fn.includes('"screen_share"')&&fn.includes("authorization.can_publish_audio")&&fn.includes("canPublishData: false")],
 ["capabilities returned to renderer",fn.includes("canPublishAudio: authorization.can_publish_audio")&&fn.includes("canPublishScreen: authorization.can_publish_screen")],
 ["fail-closed restricted CORS",fn.includes("PICOM_ALLOWED_ORIGINS")&&fn.includes("if (!allowedOrigins.size)")&&fn.includes("Origin is not allowed")&&!fn.includes('"Access-Control-Allow-Origin": "*"')&&!fn.includes("http://127.0.0.1:5173,http://localhost:5173")],
 ["safe provider URL",fn.includes('url.protocol === "wss:"')&&fn.includes('url.protocol === "ws:"')&&fn.includes("url.username || url.password")],
 ["method and bounded JSON",fn.includes("maxBodyBytes = 2048")&&fn.includes("Content-Type must be application/json")&&fn.includes("methodNotAllowed")],
 ["deterministic identity room",fn.includes("auth.user.id")&&fn.includes("createPicomLiveKitRoomName")&&fn.includes("matchesPicomLiveKitRoomName")],
 ["hosted negative matrix prepared",["expired","malformed","unauthorized","banned","wrong method","Origin is not allowed"].every((term)=>staging.toLowerCase().includes(term.toLowerCase()))],
 ["explicit staging deploy guard",deploy.includes("STAGING_ONLY")&&deploy.includes("PICOM_CONFIRM_LIVEKIT_MIGRATIONS_APPLIED")&&deploy.includes("secrets","list")],
 ["secret server boundary",fn.includes('getRequiredEnv("LIVEKIT_API_SECRET")')&&!client.includes("LIVEKIT_API_SECRET")],
];
for(const [label,pass] of checks){if(!pass)throw new Error(`FAIL ${label}`);console.log(`PASS ${label}`)}console.log("Secure LiveKit token authorization smoke passed.");
