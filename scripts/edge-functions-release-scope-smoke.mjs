import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");
const manifest=JSON.parse(read("supabase/functions/release-manifest.json"));
const release=[...manifest.releasePublic,...manifest.releaseAuthenticated,...manifest.releaseInternal].map((item)=>item.name);
assert.deepEqual(new Set(release).size,release.length,"release function names must be unique");
for(const name of ["health","client-config","livekit-token","meeting-token","livekit-moderation","validate-file","user-data-export","account-deletion","account-deletion-finalize"])assert.ok(release.includes(name),`missing release function: ${name}`);
for(const name of ["accept-invite","moderation-helper","notification-fanout","webhook-message"])assert.ok(manifest.excluded.some((item)=>item.name===name),`missing truthful exclusion: ${name}`);
const cors=read("supabase/functions/_shared/cors.ts");const request=read("supabase/functions/_shared/request.ts");const moderation=read("supabase/functions/livekit-moderation/index.ts");const deploy=read("scripts/deploy-release-edge-functions.mjs");const runner=read("scripts/hosted-staging-edge-functions-validation.mjs");
assert.ok(cors.includes("PICOM_ALLOWED_ORIGINS")&&cors.includes("Origin is not allowed"),"origin allowlist missing");
assert.ok(request.includes("PAYLOAD_TOO_LARGE")&&request.includes("Content-Type must be application/json"),"bounded JSON contract missing");
assert.ok(moderation.includes("handleCorsPreflight")&&moderation.includes("readBoundedJsonObject")&&moderation.includes("requireSupabaseUser"),"LiveKit moderation hardening missing");
assert.ok(deploy.includes("PICOM_CONFIRM_EDGE_DEPLOY")&&deploy.includes("PICOM_EDGE_STAGING_PROJECT_REF")&&!deploy.includes("SUPABASE_ACCESS_TOKEN="),"staging-only deploy guard missing");
assert.ok(runner.includes("validateDeniedOrigin")&&runner.includes("invalid.synthetic.jwt")&&!runner.includes("INVITE_ACCEPTANCE_NOT_IMPLEMENTED"),"hosted allowed/denied release matrix missing");
for(const source of [cors,request,moderation,deploy,runner])assert.ok(!/sb_secret_[A-Za-z0-9_-]{8,}/.test(source),"secret value pattern found");
const livekitWebhook=read("supabase/functions/livekit-webhook/index.ts");assert.ok(release.includes("livekit-webhook")&&livekitWebhook.includes("verifyLiveKitWebhook")&&livekitWebhook.includes('requiredEnv("SUPABASE_SERVICE_ROLE_KEY")')&&!livekitWebhook.includes("console."),"signed internal LiveKit webhook contract missing");
console.log("Edge Function release scope, JWT, CORS, body, deploy, and secret-boundary smoke: PASS");
