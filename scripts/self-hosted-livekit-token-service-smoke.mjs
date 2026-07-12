import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const fn = read("supabase/functions/livekit-token/index.ts");
const helper = read("supabase/functions/_shared/livekit-token.ts");
const deploy = read("scripts/deploy-self-hosted-livekit-token-staging.mjs");
const authorization = read("supabase/migrations/20260712166400_active_member_voice_authorization_ambiguity_fix.sql");
const docs = read("docs/self-hosted-livekit-supabase-token.md");

const checks = [
  ["server-only provider secrets", ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"].every((term) => fn.includes(term)) && !deploy.includes("VITE_LIVEKIT_API_SECRET")],
  ["explicit V1 backend gate", fn.includes("PICOM_V1_VOICE_SCREEN_ENABLED")],
  ["JWT and canonical profile", fn.includes("requireSupabaseUser") && fn.includes('.from("profiles")') && fn.includes("canonicalParticipantName") && fn.includes("auth.user.id")],
  ["active member authorization", fn.includes('rpc("authorize_livekit_room"') && authorization.includes("authorize_livekit_room")],
  ["ordinary role-independent grants", !fn.includes("manageCommunity") && fn.includes("authorization.can_publish_audio") && fn.includes("authorization.can_publish_screen")],
  ["least privilege token", helper.includes("canPublishSources") && fn.includes('"microphone"') && fn.includes('"screen_share"') && fn.includes('"screen_share_audio"') && fn.includes("canPublishData: false") && !fn.includes('"camera" as const')],
  ["short token lifetime", fn.includes("10 * 60")],
  ["method body CORS rate safety", fn.includes("maxBodyBytes = 2048") && fn.includes("PICOM_ALLOWED_ORIGINS") && fn.includes("consume_current_user_action_rate_limit")],
  ["protected external config only", deploy.includes("must stay outside the repository") && deploy.includes("Initial deployment requires exactly one valid active LiveKit key pair")],
  ["trusted self-hosted WSS only", deploy.includes("wss://${hostname}") && deploy.includes(".invalid")],
  ["temporary Supabase env-file", deploy.includes("supabase@2.109.1") && deploy.includes('"--env-file"') && deploy.includes("rmSync(workDir")],
  ["role and media hosted evidence", deploy.includes("livekit-token-member-hosted-fixture.mjs") && deploy.includes("hosted-member-voice-screen-e2e.mjs")],
  ["safe blocked mode", deploy.includes("No network request was made and no value was printed")],
  ["truthful hosted blocker", docs.includes("BLOCKED_PENDING_REAL_SELF_HOSTED_STAGING")],
];

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}
console.log("Self-hosted Supabase LiveKit token service contract passed.");
