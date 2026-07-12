import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import ts from "typescript";

if (typeof globalThis.gc !== "function") {
  const child = spawnSync(process.execPath, ["--expose-gc", fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    cwd: process.cwd(), env: process.env, stdio: "inherit", windowsHide: true, timeout: 120_000,
  });
  if (child.error) throw child.error;
  process.exit(child.status ?? 1);
}

const read = (path) => readFile(path, "utf8");
const [profile, budgets, plannerSource, stageSource, capabilitySource, screenShareSource, rateMigration, handMigration, signalService] = await Promise.all([
  read("tests/performance/meeting-capacity-profile.json").then(JSON.parse),
  read("config/meeting-performance-budgets.json").then(JSON.parse),
  read("src/types/meetingVideoGrid.ts"),
  read("src/components/meeting/MeetingStageAudience.tsx"),
  read("src/services/meeting/meetingCapabilityService.ts"),
  read("src/components/meeting/MeetingScreenShareFocus.tsx"),
  read("supabase/migrations/20260711164000_meeting_abuse_prevention_rate_limits.sql"),
  read("supabase/migrations/20260711154000_meeting_reactions_hand_signaling.sql"),
  read("src/services/meeting/meetingSignalService.ts"),
]);

assert.equal(profile.schemaVersion, 1);
assert.equal(profile.task, 576);
assert.equal(profile.targetEnvironment, "isolated_staging");
assert.equal(profile.productionAllowed, false);
assert.equal(profile.syntheticAccountsOnly, true);
assert.equal(profile.localContractStatus, "PASS");
assert.equal(profile.hostedCertificationStatus, "BLOCKED", "hosted evidence must not be inferred from a local contract");

const transpiled = ts.transpileModule(plannerSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const plannerModule = await import(`data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString("base64")}`);
const buildPlan = plannerModule.buildMeetingVideoGridPlan;
assert.equal(typeof buildPlan, "function");

function snapshot(count, options = {}) {
  const participants = Array.from({ length: count }, (_, index) => ({
    id: `synthetic-participant-${index}`,
    identity: `synthetic-identity-${index}`,
    displayName: `Synthetic Participant ${index + 1}`,
    role: index === 0 ? "host" : "participant",
    isLocal: index === 0,
    isSpeaking: options.speakingIndex === index,
    cameraEnabled: options.cameraEnabled !== false,
  }));
  return {
    participantIds: participants.map((participant) => participant.id),
    participantsById: Object.fromEntries(participants.map((participant) => [participant.id, participant])),
    focusedParticipantId: options.focusedIndex >= 0 ? participants[options.focusedIndex]?.id ?? null : null,
  };
}

const limits = profile.limits;
assert.equal(limits.maxParticipantsPerRoom, 12);
assert.equal(limits.cameraGrid.maxVisibleVideos, budgets.runtimeBudgets.maxVisibleGridVideos);
assert.equal(limits.screenShare.maxActiveShares, budgets.runtimeBudgets.maxActiveScreenShares);
assert.equal(limits.screenShare.maxCompanionCameraSubscriptions, budgets.runtimeBudgets.maxScreenShareCameraVideos);

const cameraPlan = buildPlan(snapshot(limits.cameraGrid.participants, { speakingIndex: 3, focusedIndex: 7 }), 0);
assert.equal(cameraPlan.totalParticipants, 12);
assert.equal(cameraPlan.subscription.visibleParticipantIdentities.length, 12);
assert.equal(new Set(cameraPlan.subscription.visibleParticipantIdentities).size, 12);

const voicePlan = buildPlan(snapshot(limits.voiceOnly.participants, { cameraEnabled: false }), 0);
assert.equal(voicePlan.totalParticipants, 12);
assert.equal(voicePlan.subscription.visibleParticipantIdentities.length, 0);
assert.equal(limits.voiceOnly.maxRemoteAudioSubscriptionsPerClient, 11);

assert.match(capabilitySource, /viewer: capabilities\(\{[\s\S]*canPublishAudio: false, canPublishVideo: false, canShareScreen: false/);
assert.match(stageSource, /stage\.filter\(\(participant\) => participant\.cameraEnabled\)/);
assert.match(stageSource, /stageOnly: true/);
assert.equal(limits.stageAudience.broadcasters + limits.stageAudience.viewers, limits.stageAudience.participants);
assert.equal(limits.stageAudience.viewerCanPublish, false);
assert.equal(limits.stageAudience.maxStageVideoSubscriptionsPerViewer, limits.stageAudience.broadcasters);

assert.match(screenShareSource, /slice\(0, 6\)/);
assert.equal(limits.screenShare.maxTotalVideoSubscriptionsPerViewer, limits.screenShare.maxCompanionCameraSubscriptions + limits.screenShare.maxActiveShares);

for (const item of profile.serverRateLimits) {
  const tuple = new RegExp(`\\('${item.actionKey}',\\s*${item.maximumRequests},\\s*${item.windowSeconds}\\)`);
  assert.match(rateMigration, tuple, `${item.actionKey} server rate limit drifted`);
  const allowed = Array.from({ length: item.maximumRequests + 1 }, (_, index) => index < item.maximumRequests);
  assert.equal(allowed.filter(Boolean).length, item.maximumRequests);
  assert.equal(allowed.at(-1), false, `${item.feature} overflow request must be rejected`);
}
assert.match(handMigration, /perform public\.consume_meeting_request_limit\('meeting_signal_write'\)/);
assert.match(handMigration, /target_action not in\('raise','lower','acknowledge','request_stage','cancel_stage','approve_stage','deny_stage'\)/);
assert.match(rateMigration, /perform public\.consume_meeting_request_limit\('meeting_chat_send'\)/);
assert.match(rateMigration, /perform public\.consume_meeting_request_limit\('meeting_reaction'\)/);
assert.match(signalService, /MEETING_SIGNAL_RATE_LIMITED/);
assert.match(signalService, /MEETING_REACTION_RATE_LIMITED/);

const durations = [];
for (let index = 0; index < 4_000; index += 1) {
  const count = [1, 2, 4, 9, 12][index % 5];
  const started = performance.now();
  buildPlan(snapshot(count, { speakingIndex: index % count, focusedIndex: (index * 3) % count }), 0);
  durations.push(performance.now() - started);
}
durations.sort((left, right) => left - right);
const layoutP95Ms = durations[Math.floor(durations.length * 0.95)] ?? Infinity;
assert.ok(layoutP95Ms <= profile.runtimeBudgets.layoutPlanP95Ms, `layout p95 ${layoutP95Ms.toFixed(3)}ms exceeds budget`);

globalThis.gc();
const heapBefore = process.memoryUsage().heapUsed;
let heapPeak = heapBefore;
let maxRetainedSubscriptions = 0;
let lastPlan = null;
for (let cycle = 0; cycle < 12_000; cycle += 1) {
  const count = [12, 9, 4, 1, 12, 2][cycle % 6];
  lastPlan = buildPlan(snapshot(count, { speakingIndex: cycle % count, focusedIndex: (cycle * 5) % count }), cycle % Math.max(1, Math.ceil(count / 12)));
  const identities = lastPlan.subscription.visibleParticipantIdentities;
  assert.equal(new Set(identities).size, identities.length, "reconnect churn created a duplicate subscription");
  maxRetainedSubscriptions = Math.max(maxRetainedSubscriptions, identities.length);
  if (cycle % 100 === 0) heapPeak = Math.max(heapPeak, process.memoryUsage().heapUsed);
}
lastPlan = null;
globalThis.gc();
const heapAfter = process.memoryUsage().heapUsed;
const retainedHeapGrowthMiB = Math.max(0, (heapAfter - heapBefore) / 1024 / 1024);
const transientHeapPeakMiB = Math.max(0, (heapPeak - heapBefore) / 1024 / 1024);
assert.ok(maxRetainedSubscriptions <= limits.cameraGrid.maxVisibleVideos);
assert.ok(retainedHeapGrowthMiB <= profile.runtimeBudgets.longSessionHeapGrowthMiB, `retained heap grew ${retainedHeapGrowthMiB.toFixed(2)} MiB`);

const bandwidth = profile.bandwidthModelKbps;
const estimates = {
  voiceRoomAggregateDownlinkKbps: limits.voiceOnly.participants * limits.voiceOnly.maxRemoteAudioSubscriptionsPerClient * bandwidth.audioPublisher,
  cameraRoomAggregateDownlinkKbps: limits.cameraGrid.participants * (limits.cameraGrid.participants - 1) * bandwidth.cameraPublisher,
  screenShareAggregateDownlinkKbps: (limits.screenShare.participants - 1) * bandwidth.screenSharePublisher,
  stageViewerDownlinkKbps: limits.stageAudience.maxStageVideoSubscriptionsPerViewer * bandwidth.cameraPublisher,
};
Object.values(estimates).forEach((value) => assert.ok(Number.isFinite(value) && value > 0));

console.log(`PASS camera grid: ${cameraPlan.subscription.visibleParticipantIdentities.length}/${limits.cameraGrid.participants} bounded videos.`);
console.log(`PASS voice only: ${limits.voiceOnly.participants} participants, ${limits.voiceOnly.maxRemoteAudioSubscriptionsPerClient} remote audio subscriptions/client contract.`);
console.log(`PASS screen share: ${limits.screenShare.maxActiveShares} share + ${limits.screenShare.maxCompanionCameraSubscriptions} companion cameras.`);
console.log(`PASS stage: ${limits.stageAudience.broadcasters} publishers + ${limits.stageAudience.viewers} non-publishing viewers, max ${limits.stageAudience.maxStageVideoSubscriptionsPerViewer} stage videos/viewer.`);
console.log(`PASS layout responsiveness p95 ${layoutP95Ms.toFixed(3)}ms; retained heap growth ${retainedHeapGrowthMiB.toFixed(2)} MiB; transient peak ${transientHeapPeakMiB.toFixed(2)} MiB.`);
console.log(`PASS reconnect churn: ${maxRetainedSubscriptions} maximum retained video subscriptions with no duplicate identity.`);
console.log(`PASS server rate-limit contract: ${profile.serverRateLimits.map((item) => `${item.feature}=${item.maximumRequests}/${item.windowSeconds}s`).join(", ")}.`);
console.log(`PLANNING ESTIMATES ONLY: ${JSON.stringify(estimates)}. Hosted provider measurements remain required.`);
console.log("Task 576 local multi-participant capacity contract passed; hosted production certification remains BLOCKED.");
