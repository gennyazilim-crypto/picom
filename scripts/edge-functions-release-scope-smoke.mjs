import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const manifest = JSON.parse(read("supabase/functions/release-manifest.json"));
const releaseItems = [...manifest.releasePublic, ...manifest.releaseAuthenticated, ...manifest.releaseInternal];
const release = releaseItems.map((item) => item.name);
const excluded = new Map(manifest.excluded.map((item) => [item.name, item]));
assert.equal(manifest.schemaVersion, 2, "V1 Edge manifest schema must be explicit");
assert.deepEqual(release, ["client-config", "health", "validate-file", "user-data-export", "livekit-token", "livekit-moderation", "meeting-join", "meeting-token", "meeting-captions", "livekit-webhook", "meeting-captions-agent"], "only V1-ready Edge Functions may be release-scoped");
assert.equal(new Set(release).size, release.length, "release function names must be unique");
assert.deepEqual(manifest.requiredSecretNames, ["PICOM_ALLOWED_ORIGINS", "LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"], "V1 Edge scope must declare protected provider secrets by name");
for (const item of releaseItems) {
  assert.equal(typeof item.verifyJwt, "boolean", `${item.name} must declare verifyJwt`);
  assert.ok(!read(`supabase/functions/${item.name}/index.ts`).includes("status: 501"), `${item.name} must not be a placeholder`);
}
for (const name of ["account-deletion", "account-deletion-finalize", "accept-invite", "moderation-helper", "notification-fanout", "webhook-message"]) assert.ok(excluded.has(name), `missing truthful V1 exclusion: ${name}`);
for (const name of ["livekit-token", "livekit-moderation", "livekit-webhook", "meeting-join", "meeting-token", "meeting-captions"]) assert.ok(release.includes(name), `${name} must remain in the V1 Voice/Screen/Meeting scope`);
const config = read("supabase/functions/client-config/index.ts");
for (const expected of ["enableRealtime: true", "enableDirectMessages: true", "enableFriends: true", "enableDiagnostics: true", "enableVoiceRooms: true", "enableScreenShare: true", "enableDiscovery: false", "enableBots: false", "enableWebhooks: false", "enableAutoUpdate: false"]) assert.ok(config.includes(expected), `client-config V1 flag mismatch: ${expected}`);
const cors = read("supabase/functions/_shared/cors.ts");
const request = read("supabase/functions/_shared/request.ts");
const auth = read("supabase/functions/_shared/supabase-auth.ts");
const deploy = read("scripts/deploy-release-edge-functions.mjs");
assert.ok(cors.includes("PICOM_ALLOWED_ORIGINS") && cors.includes("Origin is not allowed"), "origin allowlist missing");
assert.ok(request.includes("maxBytes") && request.includes("TextEncoder"), "shared bounded-body helper missing");
assert.ok(auth.includes('headers.get("Authorization")') && auth.includes("getUser"), "shared JWT verification helper missing");
assert.ok(deploy.includes("PICOM_CONFIRM_EDGE_DEPLOY") && deploy.includes("STAGING_ONLY"), "deployment must require explicit staging confirmation");
assert.ok(deploy.includes("PICOM_EDGE_STAGING_PROJECT_REF"), "deployment must pin the approved staging project");
assert.ok(!deploy.includes("console.log(process.env") && !deploy.includes("console.log(Deno.env"), "deployment must not print secret values");
console.log("V1 Edge Function release scope contract passed.");
