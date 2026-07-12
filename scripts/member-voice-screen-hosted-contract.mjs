import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const workflow = read(".github/workflows/member-voice-screen-hosted.yml");
const orchestrator = read("scripts/hosted-member-voice-screen-e2e.mjs");
const main = read("scripts/fixtures/livekit-hosted-e2e/main.cjs");
const preload = read("scripts/fixtures/livekit-hosted-e2e/preload.cjs");
const renderer = read("scripts/fixtures/livekit-hosted-e2e/renderer.ts");
const migration = read("supabase/migrations/20260712166500_fix_livekit_voice_moderation_ambiguity.sql");
const hierarchyMigration = read("supabase/migrations/20260712166510_voice_moderation_role_level_helper.sql");
const deploy = read("scripts/deploy-livekit-token-staging.mjs");
const releaseScope = read("src/config/v1ReleaseScope.ts");

for (const marker of ["workflow_dispatch", "environment: hosted-staging", "permissions:\n  contents: read", "xvfb-run -a npm run voice:screen:hosted:e2e", "voice:screen:hosted:e2e", "task-665-hosted-member-voice-screen-evidence"]) assert.ok(workflow.includes(marker), `hosted workflow missing ${marker}`);
assert.ok(!workflow.includes("continue-on-error") && !workflow.includes("service-role"), "hosted workflow must fail closed and must not request service-role credentials");
assert.ok(workflow.includes("chown root:root node_modules/electron/dist/chrome-sandbox") && workflow.includes("chmod 4755 node_modules/electron/dist/chrome-sandbox") && !workflow.includes("--no-sandbox"), "Linux Electron must use the configured SUID sandbox rather than disabling sandboxing");
for (const marker of ["OWNER", "ADMIN", "MODERATOR", "MEMBER", "VISITOR", "NON_MEMBER", "BANNED", "authorize_livekit_voice_moderation", "canPublishAudio", "canPublishScreen", "runElectronHarness", "containsSecrets: false"]) assert.ok(orchestrator.includes(marker), `hosted orchestrator missing ${marker}`);
for (const marker of ["contextIsolation: true", "nodeIntegration: false", "sandbox: true", "PICOM_HOSTED_E2E_CONFIG_FD", "new fs.ReadStream", "simulate-reconnect", "enableNetworkEmulation", "cleanup"]) assert.ok(main.includes(marker), `Electron harness missing ${marker}`);
assert.ok(orchestrator.includes('stdio: ["ignore", "pipe", "pipe", "pipe"]') && orchestrator.includes("child.stdio[3].end"), "hosted tokens must cross an inherited one-way pipe, not argv or disk");
assert.ok(orchestrator.includes("configPipeError") && orchestrator.includes("process.env.DISPLAY"), "hosted Electron transport must catch pipe failures and require the outer Xvfb display");
assert.ok(preload.includes("contextBridge.exposeInMainWorld") && !preload.includes("remote"), "preload must expose only a narrow validated IPC bridge");
for (const marker of ["LocalAudioTrack", "LocalVideoTrack", "Track.Source.Microphone", "Track.Source.ScreenShare", "getRTCStatsReport", "bytesReceived", "videoWidth", "ActiveSpeakersChanged", "SignalReconnecting", "TrackMuted", "TrackUnmuted", "simulateScenario", "unpublishTrack", "readyState === \"ended\""]) assert.ok(renderer.includes(marker), `renderer media proof missing ${marker}`);
assert.ok(main.includes('sendCommand("member", "verify-media"') && orchestrator.includes("postReconnectMediaPassed"), "hosted reconnect must re-prove remote audio and screen rendering");
for (const marker of ["actor_member.community_id", "actor_ban.community_id", "actor_timeout.community_id", "target_member.community_id", "community.community_id"]) {
  if (marker !== "community.community_id") assert.ok(migration.includes(marker), `moderation ambiguity migration missing ${marker}`);
}
assert.ok(migration.includes("channel.community_id=target_community_id") && !migration.includes("where community_id=target_community_id"), "moderation migration must qualify colliding community_id references");
for (const marker of ["community.id=target_community_id", "member.community_id=target_community_id", "role_link.member_id=member.id", "revoke all on function public.community_user_max_role_level"]) assert.ok(hierarchyMigration.includes(marker), `moderation hierarchy helper missing ${marker}`);
assert.ok(deploy.includes('moderationAmbiguityFixMigrationVersion = "20260712166500"') && deploy.includes('moderationRoleLevelHelperMigrationVersion = "20260712166510"') && deploy.includes('process.argv.includes("--migrations-only")') && workflow.includes("livekit:token:deploy:staging -- --apply --migrations-only"), "protected workflow must apply and verify the reviewed moderation fixes without rebuilding the already deployed Function");
assert.ok(!orchestrator.includes("LIVEKIT_API_SECRET") && !orchestrator.includes("LIVEKIT_API_KEY"), "hosted client proof must use Edge-issued participant tokens, not provider credentials");
assert.match(releaseScope, /voiceRooms:\s*hidden\(/, "Task 665 must not include Voice Rooms before native/security gates");
assert.match(releaseScope, /screenShare:\s*hidden\(/, "Task 665 must not include Screen Share before native/security gates");

console.log("Hosted member Voice/Screen E2E contract passed without network access.");
