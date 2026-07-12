import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const valueAfter = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const run = process.argv.includes("--run");
const matrixPath = "tests/hosted/meeting-final-backend-matrix.json";
const evidencePath = valueAfter("--evidence") ?? "docs/evidence/task-577-hosted-meeting-backend.json";
const [matrix, evidence] = await Promise.all([
  readFile(matrixPath, "utf8").then(JSON.parse),
  readFile(evidencePath, "utf8").then(JSON.parse),
]);
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const statuses = new Set(["PASS", "FAIL", "BLOCKED", "NOT_APPLICABLE"]);

check(matrix.schemaVersion === 1 && matrix.task === 577, "matrix identity is invalid");
check(matrix.target === "approved_staging" && matrix.productionAllowed === false, "matrix must prohibit production");
check(matrix.syntheticAccountsOnly === true && matrix.requiredConfirmation === "STAGING_ONLY", "staging safety guard is missing");
check(JSON.stringify(matrix.roles) === JSON.stringify(["owner", "admin", "moderator", "member", "visitor", "guest", "blocked"]), "role matrix is incomplete");
const gates = Array.isArray(matrix.gates) ? matrix.gates : [];
check(gates.length === 18 && new Set(gates.map((gate) => gate.id)).size === gates.length, "18 unique backend gates are required");
for (const gate of gates) {
  check(typeof gate.id === "string" && gate.id.length > 3, "gate id is invalid");
  check(typeof gate.required === "boolean", `${gate.id} required flag is missing`);
  check(Array.isArray(gate.requiredRoles), `${gate.id} requiredRoles is invalid`);
  for (const role of gate.requiredRoles ?? []) check(matrix.roles.includes(role), `${gate.id} contains unknown role ${role}`);
}

check(evidence.schemaVersion === 1 && evidence.task === 577, "evidence identity is invalid");
check(evidence.environmentClass === "approved_staging" && evidence.productionUsed === false, "evidence target is unsafe");
check(evidence.syntheticAccountsOnly === true, "evidence must use synthetic accounts only");
check(statuses.has(evidence.executionStatus), "execution status is invalid");
check(evidence.privateDataCaptured === false && evidence.rawMediaStored === false && evidence.redactionReviewed === true, "evidence privacy declaration is invalid");
const results = Array.isArray(evidence.gateResults) ? evidence.gateResults : [];
check(results.length === gates.length, "evidence must cover every backend gate");

for (const gate of gates) {
  const result = results.find((item) => item.id === gate.id);
  check(Boolean(result), `evidence missing ${gate.id}`);
  if (!result) continue;
  check(statuses.has(result.status), `${gate.id} status is invalid`);
  check(typeof result.reasonCode === "string" && /^[a-z0-9_]{3,100}$/.test(result.reasonCode), `${gate.id} reasonCode is invalid`);
  check(Array.isArray(result.evidenceReferences), `${gate.id} evidenceReferences is invalid`);
  for (const reference of result.evidenceReferences ?? []) {
    check(typeof reference === "string" && reference.startsWith("docs/evidence/task-577/") && !path.isAbsolute(reference) && !reference.includes(".."), `${gate.id} evidence reference is unsafe`);
  }
  if (run && gate.required) check(result.status === "PASS", `${gate.id} must pass for final certification`);
  if (run && gate.id === "caption_endpoint_when_enabled") {
    const allowed = evidence.captionProviderEnabled === false ? new Set(["PASS", "NOT_APPLICABLE"]) : new Set(["PASS"]);
    check(allowed.has(result.status), "caption endpoint status does not match provider configuration");
  }
  if (run && result.status === "PASS") check(result.evidenceReferences.length > 0, `${gate.id} pass requires redacted evidence`);
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
  check(process.env.PICOM_FINAL_MEETING_CONFIRM === "STAGING_ONLY", "PICOM_FINAL_MEETING_CONFIRM must equal STAGING_ONLY");
  check(evidence.executionStatus === "PASS", "final hosted evidence must be PASS");
  check(typeof evidence.runId === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(evidence.runId), "runId is invalid");
  check(typeof evidence.tester === "string" && evidence.tester.length >= 2, "tester is required");
  check(evidence.migrations?.committedHead === evidence.migrations?.stagingHead, "committed migrations do not match staging");
  check(evidence.migrations?.checksumsMatch === true, "staging migration checksums are not confirmed");
  check(evidence.fixtureAccessRevocation?.status === "PASS" && evidence.fixtureAccessRevocation?.revoked === true, "temporary fixture access was not revoked");
  check(typeof evidence.fixtureAccessRevocation?.revokedAt === "string" && Number.isFinite(Date.parse(evidence.fixtureAccessRevocation.revokedAt)), "fixture revocation time is invalid");
  for (const reference of results.flatMap((item) => item.evidenceReferences ?? [])) {
    try { await access(reference); } catch { failures.push(`evidence file does not exist: ${reference}`); }
  }
}

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exit(1);
}

if (!run) {
  console.log(`CONTRACT PASS: Task 577 covers ${gates.length} backend gates across ${matrix.roles.length} access roles.`);
  console.log(`HOSTED EXECUTION ${evidence.executionStatus}: no network request, provider connection, staging mutation, or credential access occurred.`);
  process.exit(0);
}

const runNode = (script, args = []) => {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(), env: process.env, stdio: "inherit", windowsHide: true, timeout: 15 * 60_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed with exit code ${result.status}`);
};

runNode("scripts/supabase-migration-integrity.mjs");
runNode("scripts/secret-exposure-smoke-test.mjs");
runNode("scripts/meeting-contract-suite.mjs");
runNode("scripts/hosted-staging-rls-validation.mjs", ["--run"]);
runNode("scripts/hosted-staging-realtime-validation.mjs", ["--run"]);
runNode("scripts/hosted-staging-edge-functions-validation.mjs", ["--run"]);
runNode("scripts/hosted-two-client-meeting-e2e.mjs", ["--run"]);
console.log(`HOSTED PASS: Task 577 final backend run ${evidence.runId} passed all protected Supabase, LiveKit, Edge, privacy, audit, and revocation gates.`);
