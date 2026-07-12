import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const [matrix, evidence, hostedEvidence, remediation] = await Promise.all([
  readFile("tests/security/meeting-security-final-gate.json", "utf8").then(JSON.parse),
  readFile("docs/evidence/task-581-meeting-security-gate.json", "utf8").then(JSON.parse),
  readFile("docs/evidence/task-577-hosted-meeting-backend.json", "utf8").then(JSON.parse),
  readFile("docs/meeting-security-remediation.md", "utf8"),
]);
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(matrix.schemaVersion === 1 && matrix.task === 581, "matrix identity is invalid");
check(JSON.stringify(matrix.roles) === JSON.stringify(["owner", "admin", "moderator", "member", "visitor", "guest", "blocked", "non_participant"]), "role matrix is incomplete");
const attempts = Array.isArray(matrix.accessAttempts) ? matrix.accessAttempts : [];
check(attempts.length === 9 && new Set(attempts.map((attempt) => attempt.resource)).size === attempts.length, "nine unique unauthorized-access resources are required");
for (const attempt of attempts) {
  const covered = new Set([...(attempt.allowedRoles ?? []), ...(attempt.deniedRoles ?? [])]);
  check(covered.size === matrix.roles.length && matrix.roles.every((role) => covered.has(role)), `${attempt.resource} does not classify every role`);
  check(!(attempt.allowedRoles ?? []).some((role) => (attempt.deniedRoles ?? []).includes(role)), `${attempt.resource} has conflicting role outcomes`);
  for (const role of ["blocked", "non_participant"]) check(attempt.deniedRoles.includes(role), `${attempt.resource} must deny ${role}`);
}
check(Array.isArray(matrix.securityControls) && matrix.securityControls.length === 13 && new Set(matrix.securityControls).size === 13, "13 unique security controls are required");
check(matrix.releasePolicy?.dataOrMediaLeakSeverity === "release_blocking" && matrix.releasePolicy?.missingEvidenceDecision === "NO_GO", "release policy must fail closed");

check(evidence.schemaVersion === 1 && evidence.task === 581, "evidence identity is invalid");
check(evidence.localGateStatus === "PASS", "local security gate status is not PASS");
check(evidence.hostedGateStatus === hostedEvidence.executionStatus, "hosted status must match Task 577 evidence");
check(evidence.stableDecision === "NO_GO", "stable decision must remain NO_GO while hosted/native evidence is blocked");
check(evidence.privateDataCaptured === false && evidence.rawMediaStored === false && evidence.sensitiveValuesRecorded === false, "evidence privacy declaration is invalid");
check(Array.isArray(evidence.localChecks) && evidence.localChecks.length === 15 && evidence.localChecks.every((item) => item.status === "PASS"), "15 local security checks must pass");
check(Array.isArray(evidence.criticalFindings) && evidence.criticalFindings.length === 0, "unresolved local critical findings exist");
check(Array.isArray(evidence.releaseBlockers) && evidence.releaseBlockers.length >= 5, "hosted/native remediation blockers are missing");
for (const blocker of evidence.releaseBlockers) check(remediation.includes(blocker), `remediation document is missing ${blocker}`);

const forbiddenKey = /password|secret.?value|access.?token|refresh.?token|service.?role.?key|private.?key|authorization|connection.?string/i;
const inspect = (value, location = "evidence") => {
  if (Array.isArray(value)) return value.forEach((item, index) => inspect(item, `${location}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) { if (forbiddenKey.test(key)) failures.push(`${location}.${key} is forbidden`); inspect(child, `${location}.${key}`); }
};
inspect(evidence);
if (failures.length) { failures.forEach((failure) => console.error(`FAIL: ${failure}`)); process.exit(1); }

const scripts = [
  "scripts/supabase-migration-integrity.mjs",
  "scripts/meeting-rls-permission-smoke.mjs",
  "scripts/livekit-meeting-token-security-smoke.mjs",
  "scripts/livekit-webhook-security-smoke.mjs",
  "scripts/meeting-privacy-consent-audit-smoke.mjs",
  "scripts/meeting-abuse-prevention-smoke.mjs",
  "scripts/meeting-captions-full-mvp-smoke.mjs",
  "scripts/meeting-observability-diagnostics-smoke.mjs",
  "scripts/electron-security-smoke-test.mjs",
  "scripts/desktop-ipc-security-audit-smoke-test.mjs",
  "scripts/ipc-invalid-payload-fuzz-test.mjs",
  "scripts/screen-share-picker-bridge-full-mvp-smoke.mjs",
  "scripts/secret-exposure-smoke-test.mjs",
  "scripts/diagnostics-redaction-smoke-test.mjs",
  "scripts/logging-service-smoke-test.mjs"
];
for (const script of scripts) {
  const result = spawnSync(process.execPath, [script], { cwd: process.cwd(), env: process.env, stdio: "inherit", windowsHide: true, timeout: 120_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed with exit code ${result.status}`);
}

console.log(`LOCAL PASS: Task 581 executed ${scripts.length} security/privacy/RLS controls across ${attempts.length} private-resource role contracts.`);
console.log(`HOSTED ${evidence.hostedGateStatus}: protected unauthorized-access execution remains required; stable decision is ${evidence.stableDecision}.`);
