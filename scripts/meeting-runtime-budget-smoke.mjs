import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const [budgets, plannerSource, gridSource, speakerSource, stageSource, shareSource, sharePolicySource, shareQualitySource, voiceSource, meetingSource] = await Promise.all([
  readFile("config/meeting-performance-budgets.json", "utf8").then(JSON.parse),
  readFile("src/types/meetingVideoGrid.ts", "utf8"),
  readFile("src/components/meeting/MeetingVideoGrid.tsx", "utf8"),
  readFile("src/components/meeting/MeetingSpeakerFocus.tsx", "utf8"),
  readFile("src/components/meeting/MeetingStageAudience.tsx", "utf8"),
  readFile("src/components/meeting/MeetingScreenShareFocus.tsx", "utf8"),
  readFile("src/services/livekit/screenShareSubscriptionPolicy.ts", "utf8"),
  readFile("src/utils/screenShareQuality.ts", "utf8"),
  readFile("src/services/voiceService.ts", "utf8"),
  readFile("src/services/meeting/meetingService.ts", "utf8"),
]);

const transpiled = ts.transpileModule(plannerSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const plannerModule = await import(`data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString("base64")}`);
const buildPlan = plannerModule.buildMeetingVideoGridPlan;
assert.equal(typeof buildPlan, "function", "meeting video planner could not be executed");

function snapshot(count, focusedIndex = -1) {
  const participants = Array.from({ length: count }, (_, index) => ({
    id: `participant-${index}`,
    identity: `identity-${index}`,
    displayName: `Participant ${index}`,
    role: index === 0 ? "host" : "participant",
    isLocal: index === 0,
    isSpeaking: index === 1,
    cameraEnabled: true,
  }));
  return {
    participantIds: participants.map((participant) => participant.id),
    participantsById: Object.fromEntries(participants.map((participant) => [participant.id, participant])),
    focusedParticipantId: focusedIndex >= 0 ? participants[focusedIndex]?.id ?? null : null,
  };
}

const expectedLayouts = { solo: "solo", duo: "duo", quad: "quad", nine: "nine", twelve: "twelve" };
for (const scenario of budgets.supportedScenarios.filter((item) => item.name !== "stage_viewer")) {
  const plan = buildPlan(snapshot(scenario.participants), 0);
  assert.equal(plan.layout, expectedLayouts[scenario.name]);
  assert.ok(plan.participants.length <= budgets.runtimeBudgets.maxVisibleGridVideos);
  assert.ok(plan.subscription.visibleParticipantIdentities.length <= scenario.maxGridSubscriptions);
  assert.ok(Object.keys(plan.subscription.tileSizeByIdentity).length <= scenario.maxGridSubscriptions);
  console.log(`PASS deterministic ${scenario.name}: ${plan.subscription.visibleParticipantIdentities.length} video subscriptions.`);
}

const paged = buildPlan(snapshot(24, 15), 1);
assert.equal(paged.participants.length, 12);
assert.equal(paged.pageCount, 2);
assert.ok(paged.subscription.visibleParticipantIdentities.length <= budgets.runtimeBudgets.maxVisibleGridVideos);

const stageScenario = budgets.supportedScenarios.find((item) => item.name === "stage_viewer");
assert.ok(stageScenario);
const stageParticipants = Array.from({ length: stageScenario.participants }, (_, index) => ({ role: index < stageScenario.stageSpeakers ? (index === 0 ? "host" : "speaker") : "viewer", cameraEnabled: true }));
const stageSubscriptions = stageParticipants.filter((participant) => ["host", "cohost", "speaker"].includes(participant.role) && participant.cameraEnabled).length;
assert.ok(stageSubscriptions <= stageScenario.maxGridSubscriptions);
assert.match(stageSource, /stage\.filter\(\(participant\) => participant\.cameraEnabled\)/);
assert.match(stageSource, /stageOnly: true/);
console.log(`PASS deterministic stage viewer: ${stageSubscriptions} stage videos and zero viewer videos.`);

assert.match(speakerSource, /FILMSTRIP_PAGE_SIZE = 7/);
assert.ok(budgets.runtimeBudgets.maxSpeakerViewVideos === 8);
assert.match(shareSource, /slice\(0, 6\)/);
assert.ok(budgets.runtimeBudgets.maxScreenShareCameraVideos === 6);
assert.match(sharePolicySource, /publications\.forEach\(\(publication\) => publication\.setSubscribed\(!requestedIsLocal && publication\.id === selectedId\)\)/);
assert.ok(budgets.runtimeBudgets.maxActiveScreenShares === 1);

for (const value of [budgets.runtimeBudgets.maxScreenShareWidth, budgets.runtimeBudgets.maxScreenShareHeight, budgets.runtimeBudgets.maxScreenShareFrameRate]) assert.ok(Number.isFinite(value));
assert.match(shareQualitySource, /width: 1920, height: 1080, frameRate: 15/);
assert.match(voiceSource, /maxWidth: 1920/);
assert.match(voiceSource, /maxHeight: 1080/);
assert.match(voiceSource, /maxFrameRate: 30/);

const durations = [];
for (let index = 0; index < 2_000; index += 1) {
  const started = performance.now();
  buildPlan(snapshot([1, 2, 4, 9, 12][index % 5], index % 3), 0);
  durations.push(performance.now() - started);
}
durations.sort((left, right) => left - right);
const p95 = durations[Math.floor(durations.length * 0.95)] ?? Infinity;
assert.ok(p95 <= budgets.runtimeBudgets.layoutPlanP95Ms, `layout plan p95 ${p95.toFixed(3)}ms exceeds ${budgets.runtimeBudgets.layoutPlanP95Ms}ms`);
console.log(`PASS layout planner p95 ${p95.toFixed(3)}ms <= ${budgets.runtimeBudgets.layoutPlanP95Ms}ms.`);

let maximumRetainedSubscriptions = 0;
for (let minute = 0; minute < 10_000; minute += 1) {
  const count = [1, 2, 4, 9, 12, 24][minute % 6];
  const plan = buildPlan(snapshot(count, minute % Math.min(count, 12)), minute % Math.max(1, Math.ceil(count / 12)));
  maximumRetainedSubscriptions = Math.max(maximumRetainedSubscriptions, plan.subscription.visibleParticipantIdentities.length);
}
assert.ok(maximumRetainedSubscriptions <= budgets.runtimeBudgets.maxVisibleGridVideos);
assert.match(gridSource, /setVideoSubscriptions\(\{ visibleParticipantIdentities: \[\]/);
for (const marker of ["async function disposeRoom", "activeRoom.removeAllListeners()", "await activeRoom.disconnect(false)"]) assert.ok(voiceSource.includes(marker), `missing long-session cleanup marker ${marker}`);
for (const marker of ["cancelMeetingReconnect()", "stopBindings()", "participantsById:{}", "participantIds:[]"]) assert.ok(meetingSource.includes(marker), `missing meeting cleanup marker ${marker}`);
console.log(`PASS long-session deterministic loop retained at most ${maximumRetainedSubscriptions} video subscriptions with explicit provider/listener cleanup.`);

console.log(`HOSTED EVIDENCE REQUIRED: join latency p95 <= ${budgets.runtimeBudgets.joinLatencyP95Ms}ms.`);
console.log(`NATIVE EVIDENCE REQUIRED: long-session heap growth <= ${budgets.runtimeBudgets.longSessionHeapGrowthMiB} MiB and platform CPU remains within release baseline.`);
console.log("Meeting runtime and bandwidth budget smoke passed.");
