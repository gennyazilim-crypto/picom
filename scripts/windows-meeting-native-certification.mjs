import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const valueAfter = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const run = process.argv.includes("--run");
const artifactPath = valueAfter("--artifact");
const evidencePath = valueAfter("--evidence") ?? "docs/evidence/task-578-windows-meeting.json";
const [matrix, evidence] = await Promise.all([
  readFile("tests/native/windows-meeting-certification-matrix.json", "utf8").then(JSON.parse),
  readFile(evidencePath, "utf8").then(JSON.parse),
]);
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const statuses = new Set(["PASS", "FAIL", "BLOCKED"]);

check(matrix.schemaVersion === 1 && matrix.task === 578, "matrix identity is invalid");
check(matrix.platform === "windows" && JSON.stringify(matrix.supportedArchitectures) === JSON.stringify(["x64"]), "Windows x64 support boundary is invalid");
check(matrix.productionAllowed === false && matrix.controlledMachineRequired === true, "controlled-machine safety boundary is missing");
check(matrix.trustedSignatureRequired === true && matrix.remoteClientRequired === true, "signature or remote-client gate is missing");
check(matrix.requiredConfirmation === "CONTROLLED_WINDOWS_ONLY", "native confirmation is invalid");
const flows = Array.isArray(matrix.flows) ? matrix.flows : [];
check(flows.length === 22 && new Set(flows.map((flow) => flow.id)).size === flows.length, "22 unique Windows flows are required");

check(evidence.schemaVersion === 1 && evidence.task === 578, "evidence identity is invalid");
check(evidence.platform === "windows" && statuses.has(evidence.executionStatus), "evidence platform or status is invalid");
check(evidence.productionUsed === false && evidence.controlledMachine === false === (evidence.executionStatus === "BLOCKED"), "controlled-machine declaration is inconsistent");
check(evidence.rawMediaStored === false && evidence.privateDataCaptured === false && evidence.redactionReviewed === true, "evidence privacy declaration is invalid");
const results = Array.isArray(evidence.flowResults) ? evidence.flowResults : [];
check(results.length === flows.length, "evidence must cover every Windows flow");
for (const flow of flows) {
  const result = results.find((item) => item.id === flow.id);
  check(Boolean(result), `evidence missing ${flow.id}`);
  if (!result) continue;
  check(statuses.has(result.status), `${flow.id} status is invalid`);
  check(typeof result.reasonCode === "string" && /^[a-z0-9_]{3,100}$/.test(result.reasonCode), `${flow.id} reasonCode is invalid`);
  check(Array.isArray(result.evidenceReferences), `${flow.id} evidenceReferences is invalid`);
  for (const reference of result.evidenceReferences ?? []) {
    check(typeof reference === "string" && reference.startsWith("docs/evidence/task-578/") && !path.isAbsolute(reference) && !reference.includes(".."), `${flow.id} evidence reference is unsafe`);
  }
  if (run) {
    check(result.status === "PASS", `${flow.id} must pass for Windows certification`);
    check(result.evidenceReferences.length > 0, `${flow.id} pass requires redacted evidence`);
  }
}

const forbiddenKey = /password|secret|access.?token|refresh.?token|service.?role|private.?key|authorization|credential|connection.?string|serial.?number/i;
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
  check(process.platform === "win32", "native certification must run on Windows");
  check(process.env.PICOM_WINDOWS_MEETING_CONFIRM === "CONTROLLED_WINDOWS_ONLY", "PICOM_WINDOWS_MEETING_CONFIRM must equal CONTROLLED_WINDOWS_ONLY");
  check(typeof process.env.PICOM_WINDOWS_EXPECTED_PUBLISHER === "string" && process.env.PICOM_WINDOWS_EXPECTED_PUBLISHER.trim().length > 0, "approved publisher is required");
  check(evidence.executionStatus === "PASS" && evidence.controlledMachine === true, "controlled Windows execution must be PASS");
  check(evidence.machine?.osFamily === "Windows" && evidence.machine?.supportedWindowsVersion === true, "supported Windows version is not confirmed");
  check(evidence.machine?.architecture === "x64", "only the x64 package is currently certified");
  check(Number.isFinite(evidence.machine?.displayScalePercent) && evidence.machine.displayScalePercent >= 100, "display scaling is missing");
  check(Number.isInteger(evidence.machine?.monitorCount) && evidence.machine.monitorCount >= 1, "monitor count is missing");
  for (const field of ["cameraModels", "microphoneModels", "speakerModels", "gpuModels"]) check(Array.isArray(evidence.machine?.[field]) && evidence.machine[field].length > 0, `${field} inventory is missing`);
  check(evidence.remoteClient?.status === "PASS" && evidence.remoteClient?.distinctClientConfirmed === true, "distinct remote client is not proven");
  check(evidence.artifact?.signatureStatus === "PASS" && evidence.artifact?.trustedTimestamp === true, "trusted signature/timestamp is not proven");
  check(typeof evidence.artifact?.sha256 === "string" && /^[a-f0-9]{64}$/.test(evidence.artifact.sha256), "artifact SHA-256 is invalid");
  check(typeof artifactPath === "string" && artifactPath.length > 0, "--artifact is required");
}

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exit(1);
}

if (!run) {
  console.log(`CONTRACT PASS: Task 578 defines ${flows.length} Windows x64 packaged meeting flows.`);
  console.log(`NATIVE EXECUTION ${evidence.executionStatus}: no installer, device, screen source, remote client, signature, or media was accessed.`);
  process.exit(0);
}

const artifact = await readFile(artifactPath);
const digest = createHash("sha256").update(artifact).digest("hex");
check(path.basename(artifactPath) === evidence.artifact.fileName, "artifact file name does not match evidence");
check(digest === evidence.artifact.sha256, "artifact hash does not match the tested candidate");
for (const reference of results.flatMap((result) => result.evidenceReferences ?? [])) {
  try { await access(reference); } catch { failures.push(`evidence file does not exist: ${reference}`); }
}
if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exit(1);
}

const runNative = (executable, args, timeout = 10 * 60_000) => {
  const result = spawnSync(executable, args, { cwd: process.cwd(), env: process.env, stdio: "inherit", windowsHide: true, timeout });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${executable} failed with exit code ${result.status}`);
};
for (const script of [
  "scripts/verify-electron-packaging.mjs",
  "scripts/electron-security-smoke-test.mjs",
  "scripts/meeting-contract-suite.mjs",
  "scripts/meeting-device-permission-recovery-smoke.mjs",
  "scripts/meeting-production-screen-share-smoke.mjs",
  "scripts/screen-share-picker-bridge-full-mvp-smoke.mjs",
  "scripts/screen-share-publish-render-full-mvp-smoke.mjs",
]) runNative(process.execPath, [script]);
runNative("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/verify-windows-signature.ps1", "-Path", artifactPath, "-ExpectedPublisher", process.env.PICOM_WINDOWS_EXPECTED_PUBLISHER]);
console.log(`NATIVE PASS: Task 578 certified ${evidence.artifact.fileName} (${digest.slice(0, 12)}...) on the recorded controlled Windows x64 machine.`);
