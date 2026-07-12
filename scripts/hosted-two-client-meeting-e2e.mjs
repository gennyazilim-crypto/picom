import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const valueAfter = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const run = process.argv.includes("--run");
const matrixPath = "tests/e2e/meeting-two-client-hosted-matrix.json";
const evidencePath = valueAfter("--evidence") ?? "docs/evidence/task-575-hosted-two-client-meeting-e2e.json";
const [matrix, evidence] = await Promise.all([readFile(matrixPath, "utf8").then(JSON.parse), readFile(evidencePath, "utf8").then(JSON.parse)]);
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const statuses = new Set(["PASS", "FAIL", "BLOCKED", "NOT_APPLICABLE"]);

check(matrix.schemaVersion === 1 && matrix.task === 575, "matrix identity is invalid");
check(matrix.target === "staging" && matrix.productionAllowed === false, "matrix must be staging-only");
check(matrix.requiredConfirmation === "STAGING_ONLY", "matrix confirmation is missing");
check(JSON.stringify(matrix.clients) === JSON.stringify(["host_client", "participant_client"]), "matrix requires two distinct client roles");
const flows = Array.isArray(matrix.flows) ? matrix.flows : [];
const flowIds = flows.map((flow) => flow.id);
check(flows.length === 19 && new Set(flowIds).size === flows.length, "matrix needs 19 unique flows");
for (const flow of flows) {
  check(typeof flow.id === "string" && flow.id.length > 0, "flow id is missing");
  check(typeof flow.required === "boolean", `${flow.id} required flag is missing`);
  check(Array.isArray(flow.evidence) && flow.evidence.length > 0, `${flow.id} evidence requirements are missing`);
}

check(evidence.schemaVersion === 1 && evidence.task === 575, "evidence identity is invalid");
check(evidence.target === "staging" && evidence.productionUsed === false, "evidence must be staging-only");
check(statuses.has(evidence.executionStatus), "evidence execution status is invalid");
check(evidence.rawMediaStored === false, "raw media must never be stored as evidence");
check(evidence.redactionReviewed === true, "evidence must be redaction reviewed");
const results = Array.isArray(evidence.flowResults) ? evidence.flowResults : [];
check(results.length === flows.length, "evidence must contain every matrix flow");
for (const flow of flows) {
  const result = results.find((item) => item.id === flow.id);
  check(Boolean(result), `evidence missing ${flow.id}`);
  if (!result) continue;
  check(statuses.has(result.status), `${flow.id} status is invalid`);
  check(typeof result.reasonCode === "string" && /^[a-z0-9_]{3,80}$/.test(result.reasonCode), `${flow.id} reasonCode is invalid`);
  check(Array.isArray(result.evidenceReferences), `${flow.id} evidenceReferences must be an array`);
  for (const reference of result.evidenceReferences ?? []) {
    check(typeof reference === "string" && reference.startsWith("docs/evidence/task-575/") && !path.isAbsolute(reference) && !reference.includes(".."), `${flow.id} evidence reference is unsafe`);
  }
  if (run && flow.required) check(result.status === "PASS", `${flow.id} must pass in a certification run`);
  if (run && result.status === "PASS") check(result.evidenceReferences.length > 0, `${flow.id} pass requires redacted evidence`);
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
  const environmentNames = [
    "PICOM_HOSTED_MEETING_CONFIRM",
    "PICOM_MEETING_LIVEKIT_STAGING_URL", "PICOM_MEETING_LIVEKIT_STAGING_ANON_KEY", "PICOM_MEETING_LIVEKIT_STAGING_ORIGIN", "PICOM_MEETING_LIVEKIT_STAGING_CONFIRM",
    "PICOM_MEETING_ALLOWED_EMAIL", "PICOM_MEETING_ALLOWED_PASSWORD", "PICOM_MEETING_WAITING_EMAIL", "PICOM_MEETING_WAITING_PASSWORD", "PICOM_MEETING_BLOCKED_EMAIL", "PICOM_MEETING_BLOCKED_PASSWORD",
    "PICOM_MEETING_ROOM_ID", "PICOM_MEETING_SESSION_ID",
    "PICOM_LIVEKIT_WEBHOOK_STAGING_URL", "PICOM_LIVEKIT_WEBHOOK_STAGING_CONFIRM", "PICOM_LIVEKIT_WEBHOOK_API_KEY", "PICOM_LIVEKIT_WEBHOOK_API_SECRET", "PICOM_LIVEKIT_WEBHOOK_ROOM_ID", "PICOM_LIVEKIT_WEBHOOK_SESSION_ID"
  ];
  const missing = environmentNames.filter((name) => !process.env[name]?.trim());
  check(missing.length === 0, `missing protected staging configuration names: ${missing.join(", ")}`);
  check(process.env.PICOM_HOSTED_MEETING_CONFIRM === "STAGING_ONLY", "PICOM_HOSTED_MEETING_CONFIRM must equal STAGING_ONLY");
  check(process.env.PICOM_MEETING_LIVEKIT_STAGING_CONFIRM === "STAGING_ONLY", "meeting token confirmation must equal STAGING_ONLY");
  check(process.env.PICOM_LIVEKIT_WEBHOOK_STAGING_CONFIRM === "STAGING_ONLY", "webhook confirmation must equal STAGING_ONLY");
  check(evidence.executionStatus === "PASS", "certification evidence must be PASS");
  check(typeof evidence.runId === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(evidence.runId), "certification runId is invalid");
  check(typeof evidence.tester === "string" && evidence.tester.length >= 2, "certification tester is required");
  check(evidence.clients?.host_client?.status === "PASS" && evidence.clients?.participant_client?.status === "PASS", "both real clients must pass");
  for (const reference of results.flatMap((result) => result.evidenceReferences ?? [])) {
    try { await access(reference); } catch { failures.push(`evidence file does not exist: ${reference}`); }
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

if (!run) {
  console.log(`CONTRACT PASS: Task 575 matrix and redacted evidence schema cover ${flows.length} hosted flows.`);
  console.log(`HOSTED EXECUTION ${evidence.executionStatus}: no network request, provider connection, media capture, or credential access occurred.`);
  process.exit(0);
}

const runProtected = (script) => {
  const result = spawnSync(process.execPath, [script, "--run"], { cwd: process.cwd(), env: process.env, stdio: "inherit", windowsHide: true, timeout: 120_000 });
  if (result.status !== 0 || result.error) throw result.error ?? new Error(`${script} failed with ${result.status}`);
};
runProtected("scripts/livekit-meeting-token-staging-validation.mjs");
runProtected("scripts/livekit-webhook-staging-validation.mjs");
console.log(`HOSTED PASS: Task 575 two-client staging evidence ${evidence.runId} and protected token/webhook checks passed. No raw media or credential was stored.`);
