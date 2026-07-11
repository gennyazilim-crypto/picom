import { readFileSync } from "node:fs";
const read=(file)=>readFileSync(file,"utf8");
const fn=read("supabase/functions/livekit-token/index.ts"),token=read("supabase/functions/_shared/livekit-token.ts"),migration=read("supabase/migrations/20260711150100_livekit_token_authorization.sql"),config=read("supabase/config.toml"),client=read("src/services/livekit/livekitService.ts");
const checks=[
 ["JWT verified",fn.includes("requireSupabaseUser")&&config.includes("[functions.livekit-token]\nverify_jwt = true")],
 ["member and kind authorization RPC",fn.includes('rpc("authorize_livekit_room"')&&migration.includes("VOICE_MEMBERSHIP_REQUIRED")&&migration.includes("kind<>'text'")],
 ["visitor private ban timeout denial",migration.includes("community_bans")&&migration.includes("community_member_timeouts")&&migration.includes("VOICE_PRIVATE_CHANNEL_FORBIDDEN")],
 ["scoped permissions",["viewChannel","viewPrivateChannels","joinVoice","speakInVoice","shareScreen"].every((permission)=>migration.includes(`'${permission}'`))],
 ["short least privilege token",fn.includes("10 * 60")&&token.includes("canPublishSources")&&fn.includes('"microphone"')&&fn.includes('"screen_share"')&&fn.includes("authorization.can_publish_audio")&&fn.includes("canPublishData: false")],
 ["restricted CORS",fn.includes("PICOM_ALLOWED_ORIGINS")&&fn.includes("Origin is not allowed")&&!fn.includes('"Access-Control-Allow-Origin": "*"')],
 ["method and bounded JSON",fn.includes("maxBodyBytes = 2048")&&fn.includes("Content-Type must be application/json")&&fn.includes("methodNotAllowed")],
 ["deterministic identity room",fn.includes("auth.user.id")&&fn.includes("createPicomLiveKitRoomName")&&fn.includes("matchesPicomLiveKitRoomName")],
 ["secret server boundary",fn.includes('getRequiredEnv("LIVEKIT_API_SECRET")')&&!client.includes("LIVEKIT_API_SECRET")],
];
for(const [label,pass] of checks){if(!pass)throw new Error(`FAIL ${label}`);console.log(`PASS ${label}`)}console.log("Secure LiveKit token authorization smoke passed.");
