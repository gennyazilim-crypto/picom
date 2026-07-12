import { access, readFile } from "node:fs/promises";
import path from "node:path";

const valueAfter = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const run = process.argv.includes("--run");
const matrixPath = "tests/performance/meeting-hosted-capacity-matrix.json";
const evidencePath = valueAfter("--evidence") ?? "docs/evidence/task-576-meeting-capacity.json";
const [matrix, evidence, profile] = await Promise.all([
  readFile(matrixPath, "utf8").then(JSON.parse),
  readFile(evidencePath, "utf8").then(JSON.parse),
  readFile("tests/performance/meeting-capacity-profile.json", "utf8").then(JSON.parse),
]);
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const statuses = new Set(["PASS", "FAIL", "BLOCKED"]);

check(matrix.schemaVersion === 1 && matrix.task === 576, "matrix identity is invalid");
check(matrix.target === "isolated_staging" && matrix.productionAllowed === false, "matrix must be isolated-staging-only");
check(matrix.syntheticAccountsOnly === true && matrix.requiredConfirmation === "STAGING_ONLY", "synthetic-account staging guard is missing");
check(profile.hostedCertificationStatus === "BLOCKED", "local profile must not pre-certify hosted capacity");
const scenarios = Array.isArray(matrix.scenarios) ? matrix.scenarios : [];
check(scenarios.length === 4 && new Set(scenarios.map((item) => item.id)).size === 4, "four unique capacity scenarios are required");
for (const scenario of scenarios) {
  check(scenario.participants === 12, `${scenario.id} must exercise the approved 12-participant ceiling`);
  check(Array.isArray(scenario.requiredMetrics) && scenario.requiredMetrics.length >= 9, `${scenario.id} metric contract is incomplete`);
}

check(evidence.schemaVersion === 1 && evidence.task === 576, "evidence identity is invalid");
check(evidence.environmentClass === "isolated_staging" && evidence.productionUsed === false, "evidence target is unsafe");
check(evidence.syntheticAccountsOnly === true, "evidence must use synthetic accounts only");
check(statuses.has(evidence.executionStatus), "evidence execution status is invalid");
check(evidence.rawMediaStored === false && evidence.redactionReviewed === true, "evidence privacy declaration is invalid");
const results = Array.isArray(evidence.scenarioResults) ? evidence.scenarioResults : [];
check(results.length === scenarios.length, "evidence must cover every capacity scenario");

const finite = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
for (const scenario of scenarios) {
  const result = results.find((item) => item.id === scenario.id);
  check(Boolean(result), `evidence missing ${scenario.id}`);
  if (!result) continue;
  check(statuses.has(result.status), `${scenario.id} status is invalid`);
  check(typeof result.reasonCode === "string" && /^[a-z0-9_]{3,80}$/.test(result.reasonCode), `${scenario.id} reasonCode is invalid`);
  check(Array.isArray(result.evidenceReferences), `${scenario.id} evidence references are invalid`);
  if (run) {
    check(result.status === "PASS", `${scenario.id} must pass for certification`);
    for (const metric of scenario.requiredMetrics) check(finite(result.metrics?.[metric]), `${scenario.id}.${metric} must be measured`);
    check(result.metrics?.joinLatencyP95Ms <= profile.runtimeBudgets.joinLatencyP95Ms, `${scenario.id} join latency exceeds budget`);
    check(result.metrics?.clientCpuAveragePercent <= profile.runtimeBudgets.clientCpuAveragePercent, `${scenario.id} average CPU exceeds budget`);
    check(result.metrics?.clientCpuPeakPercent <= profile.runtimeBudgets.clientCpuPeakPercent, `${scenario.id} peak CPU exceeds budget`);
    check(result.metrics?.heapGrowthMiB <= profile.runtimeBudgets.longSessionHeapGrowthMiB, `${scenario.id} heap growth exceeds budget`);
    check(result.metrics?.activeSubscriptionsPeak <= scenario.maxActiveSubscriptionsPerClient, `${scenario.id} subscriptions exceed policy`);
    check(result.metrics?.reconnectSuccessRate >= profile.runtimeBudgets.reconnectSuccessRate, `${scenario.id} reconnect rate is below budget`);
    check(result.metrics?.uiResponseP95Ms <= profile.runtimeBudgets.localControlFeedbackP95Ms, `${scenario.id} UI response exceeds budget`);
    check(result.evidenceReferences.length > 0, `${scenario.id} pass requires redacted evidence`);
    if (scenario.id.startsWith("stage_")) {
      check(result.metrics?.viewerPublishedAudioTracks === 0, "stage viewers must not publish audio");
      check(result.metrics?.viewerPublishedVideoTracks === 0, "stage viewers must not publish video");
      check(result.metrics?.viewerPublishedScreenTracks === 0, "stage viewers must not publish screen tracks");
    }
  }
  for (const reference of result.evidenceReferences ?? []) {
    check(typeof reference === "string" && reference.startsWith("docs/evidence/task-576/") && !path.isAbsolute(reference) && !reference.includes(".."), `${scenario.id} evidence reference is unsafe`);
  }
}

const rateResults = Array.isArray(evidence.rateLimitResults) ? evidence.rateLimitResults : [];
check(rateResults.length === matrix.rateLimitCases.length, "rate-limit evidence is incomplete");
for (const testCase of matrix.rateLimitCases) {
  const result = rateResults.find((item) => item.id === testCase.id);
  check(Boolean(result) && statuses.has(result?.status), `${testCase.id} result is missing or invalid`);
  if (run) {
    check(result?.status === "PASS", `${testCase.id} must pass for certification`);
    check(result?.acceptedRequests === testCase.allowed, `${testCase.id} accepted count drifted`);
    check(result?.overflowRejected === true && result?.retryAfterObserved === true, `${testCase.id} did not reject overflow safely`);
  }
}

const forbiddenKey = /password|secret|access.?token|refresh.?token|service.?role|private.?key|authorization|credential|connection.?string/i;
const inspect = (value, location = "evidence") => {
  if (Array.isArray(value)) return value.forEach((item, index) => inspect(item, `${location}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKey.test(key)) failures.push(`${location}.${key} is forbidden in evidence`);
    inspect(child, `${location}.${key}`);
  }
};
inspect(evidence);

if (run) {
  check(process.env.PICOM_MEETING_LOAD_CONFIRM === "STAGING_ONLY", "PICOM_MEETING_LOAD_CONFIRM must equal STAGING_ONLY");
  check(evidence.executionStatus === "PASS", "hosted capacity evidence must be PASS");
  check(typeof evidence.runId === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(evidence.runId), "runId is invalid");
  check(typeof evidence.tester === "string" && evidence.tester.length >= 2, "tester is required");
  check(evidence.providerReview?.quotaStatus === "PASS", "provider quota review must pass");
  check(evidence.providerReview?.costStatus === "PASS", "provider cost review must pass");
  for (const reference of results.flatMap((result) => result.evidenceReferences ?? [])) {
    try { await access(reference); } catch { failures.push(`evidence file does not exist: ${reference}`); }
  }
}

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exit(1);
}

if (!run) {
  console.log(`CONTRACT PASS: Task 576 defines ${scenarios.length} staging capacity scenarios and ${matrix.rateLimitCases.length} rate-limit cases.`);
  console.log(`HOSTED EXECUTION ${evidence.executionStatus}: no network request, provider connection, media capture, production traffic, or credential access occurred.`);
  process.exit(0);
}

console.log(`HOSTED PASS: Task 576 staging capacity run ${evidence.runId} meets participant, resource, subscription, reconnect, and rate-limit budgets.`);
