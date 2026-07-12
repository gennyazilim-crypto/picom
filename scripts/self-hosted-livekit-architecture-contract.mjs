import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const infrastructure = read("src/config/voiceInfrastructureContract.ts");
const scope = read("src/config/v1ReleaseScope.ts");
const flags = read("src/services/featureFlagService.ts");
const clientConfig = read("supabase/functions/client-config/index.ts");
const tokenFunction = read("supabase/functions/livekit-token/index.ts");
const amendment = read("docs/self-hosted-livekit-amendment.md");
const memberPolicy = read("docs/community-member-media-policy.md");
const decision = read("docs/v1-voice-screen-share-decision.md");
const blockers = read("docs/release-blockers.md");

assert.match(infrastructure, /hostingMode:\s*"SELF_HOSTED_LIVEKIT"/);
assert.match(infrastructure, /cloudSubscriptionRequired:\s*false/);
assert.match(infrastructure, /productScope:\s*"IN_V1"/);
assert.match(infrastructure, /publicReleaseReadiness:\s*"BLOCKED_PENDING_SELF_HOSTED_CERTIFICATION"/);
for (const environment of ["development", "staging", "production"]) assert.ok(infrastructure.includes(environment + ":"), "missing environment contract: " + environment);
for (const feature of ["voiceRooms", "screenShare"]) assert.match(scope, new RegExp(feature + ": inV1\\("), feature + " must remain visible in V1");
assert.ok(flags.includes("enableVoiceRooms: true") && flags.includes("enableScreenShare: true"), "local Voice/Screen flags must remain enabled");
assert.ok(clientConfig.includes("enableVoiceRooms: true") && clientConfig.includes("enableScreenShare: true"), "public Voice/Screen flags must remain enabled");
for (const name of ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "PICOM_V1_VOICE_SCREEN_ENABLED"]) assert.ok(tokenFunction.includes(name), "token function missing server setting " + name);
assert.ok(!tokenFunction.includes("livekit.cloud"), "token function must not require a LiveKit Cloud domain");
for (const marker of ["REPLACES", "SELF_HOSTED_LIVEKIT", "No LiveKit Cloud subscription", "Tasks 658-673"]) assert.ok(amendment.includes(marker), "amendment missing " + marker);
assert.ok(/remain visible/i.test(amendment), "amendment must keep the Voice product surface visible");
for (const marker of [/authenticated active community member/i, /Visitor/i, /Moderation/i, /explicit user action/i, /raw microphone/i]) assert.ok(marker.test(memberPolicy), "member policy missing " + marker);
assert.ok(decision.includes("Decision: **INCLUDED IN PRODUCT SCOPE**") && decision.includes("SELF_HOSTED_LIVEKIT") && decision.includes("Task 674"), "self-hosted V1 decision boundary missing");
assert.ok(blockers.includes("SELF_HOSTED") && blockers.includes("BLOCKED / NO-GO"), "self-hosted public-release blockers must remain explicit");
for (const task of [642, 643, 644, 657, 658, 668]) {
  assert.ok(existsSync("docs/task-checkpoints") && existsSync("docs/task-checkpoints"), "checkpoint directory missing");
  assert.ok(amendment.includes("Task " + task), "historical/superseded task reference missing: " + task);
}
console.log("Self-hosted LiveKit architecture, IN_V1 visibility, member access, environment separation, and release-readiness contract passed.");
