import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const valueAfter = (name) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; };
const run = process.argv.includes("--run");
const dmgPath = valueAfter("--dmg");
const zipPath = valueAfter("--zip");
const appPath = valueAfter("--app");
const evidencePath = valueAfter("--evidence") ?? "docs/evidence/task-580-macos-meeting.json";
const [matrix, evidence] = await Promise.all([
  readFile("tests/native/macos-meeting-certification-matrix.json", "utf8").then(JSON.parse),
  readFile(evidencePath, "utf8").then(JSON.parse),
]);
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const statuses = new Set(["PASS", "FAIL", "BLOCKED"]);

check(matrix.schemaVersion === 1 && matrix.task === 580, "matrix identity is invalid");
check(matrix.platform === "macos" && JSON.stringify(matrix.supportedArchitectures) === JSON.stringify(["x64"]), "macOS x64 boundary is invalid");
check(JSON.stringify(matrix.requiredArtifacts) === JSON.stringify(["dmg", "zip"]), "DMG/ZIP boundary is invalid");
for (const gate of ["nativeBuildRequired", "developerIdRequired", "notarizationRequired", "stapleRequired", "gatekeeperRequired", "remoteClientRequired"]) check(matrix[gate] === true, `${gate} is missing`);
check(matrix.productionAllowed === false && matrix.requiredConfirmation === "NATIVE_MACOS_ONLY", "native safety confirmation is invalid");
const flows = Array.isArray(matrix.flows) ? matrix.flows : [];
check(flows.length === 27 && new Set(flows.map((flow) => flow.id)).size === flows.length, "27 unique macOS flows are required");

check(evidence.schemaVersion === 1 && evidence.task === 580, "evidence identity is invalid");
check(evidence.platform === "macos" && statuses.has(evidence.executionStatus), "evidence platform or status is invalid");
check(evidence.productionUsed === false && evidence.nativeMacosUsed === (evidence.executionStatus === "PASS"), "native macOS declaration is inconsistent");
check(evidence.privateDataCaptured === false && evidence.rawMediaStored === false && evidence.redactionReviewed === true, "evidence privacy declaration is invalid");
check(evidence.appleSensitiveMaterialCommitted === false, "Apple sensitive material must never be committed");
const results = Array.isArray(evidence.flowResults) ? evidence.flowResults : [];
check(results.length === flows.length, "evidence must cover every macOS flow");
for (const flow of flows) {
  const result = results.find((item) => item.id === flow.id);
  check(Boolean(result), `evidence missing ${flow.id}`);
  if (!result) continue;
  check(statuses.has(result.status), `${flow.id} status is invalid`);
  check(typeof result.reasonCode === "string" && /^[a-z0-9_]{3,100}$/.test(result.reasonCode), `${flow.id} reasonCode is invalid`);
  check(Array.isArray(result.evidenceReferences), `${flow.id} evidenceReferences is invalid`);
  for (const reference of result.evidenceReferences ?? []) check(typeof reference === "string" && reference.startsWith("docs/evidence/task-580/") && !path.isAbsolute(reference) && !reference.includes(".."), `${flow.id} evidence reference is unsafe`);
  if (run) { check(result.status === "PASS", `${flow.id} must pass for macOS certification`); check(result.evidenceReferences.length > 0, `${flow.id} pass requires redacted evidence`); }
}

const forbiddenKey = /password|secret|access.?token|refresh.?token|service.?role|private.?key|authorization|credential|connection.?string|certificate.?data|notary.?key/i;
const inspect = (value, location = "evidence") => {
  if (Array.isArray(value)) return value.forEach((item, index) => inspect(item, `${location}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) { if (forbiddenKey.test(key)) failures.push(`${location}.${key} is forbidden in evidence`); inspect(child, `${location}.${key}`); }
};
inspect(evidence);

if (run) {
  check(process.platform === "darwin", "native certification must run on macOS");
  check(process.env.PICOM_MACOS_MEETING_CONFIRM === "NATIVE_MACOS_ONLY", "PICOM_MACOS_MEETING_CONFIRM must equal NATIVE_MACOS_ONLY");
  check(typeof process.env.PICOM_MACOS_EXPECTED_TEAM_ID === "string" && process.env.PICOM_MACOS_EXPECTED_TEAM_ID.trim().length > 0, "approved Apple Team ID is required");
  check(evidence.executionStatus === "PASS" && evidence.nativeMacosUsed === true, "native macOS execution must be PASS");
  check(evidence.machine?.architecture === "x64" && evidence.machine?.macosVersion && evidence.machine?.hardwareFamily, "macOS x64 machine inventory is missing");
  check(Number.isInteger(evidence.machine?.monitorCount) && evidence.machine.monitorCount >= 1, "monitor count is missing");
  for (const field of ["cameraModels", "microphoneModels", "speakerModels", "gpuModels"]) check(Array.isArray(evidence.machine?.[field]) && evidence.machine[field].length > 0, `${field} inventory is missing`);
  check(evidence.remoteClient?.status === "PASS" && evidence.remoteClient?.distinctClientConfirmed === true, "distinct remote client is not proven");
  for (const artifactName of matrix.requiredArtifacts) {
    const artifact = evidence.artifacts?.[artifactName];
    check(artifact?.builtOnMacos === true && typeof artifact?.sha256 === "string" && /^[a-f0-9]{64}$/.test(artifact.sha256), `${artifactName} native artifact/hash is invalid`);
  }
  for (const trustGate of ["developerIdSignature", "nestedSignatures", "hardenedRuntime", "entitlementsReview", "notarization", "appStaple", "dmgStaple", "gatekeeper", "quarantineDownload"]) check(evidence.trust?.[trustGate] === "PASS", `${trustGate} is not proven`);
  check(typeof dmgPath === "string" && dmgPath.length > 0, "--dmg is required");
  check(typeof zipPath === "string" && zipPath.length > 0, "--zip is required");
  check(typeof appPath === "string" && appPath.length > 0, "--app is required");
}

if (failures.length) { failures.forEach((failure) => console.error(`FAIL: ${failure}`)); process.exit(1); }
if (!run) {
  console.log(`CONTRACT PASS: Task 580 defines ${flows.length} signed/notarized macOS x64 meeting flows.`);
  console.log(`NATIVE EXECUTION ${evidence.executionStatus}: no Apple identity, notary service, artifact, permission, remote client, or media was accessed.`);
  process.exit(0);
}

const verifyArtifact = async (filePath, expected) => {
  const digest = createHash("sha256").update(await readFile(filePath)).digest("hex");
  check(path.basename(filePath) === expected.fileName, `${expected.format} file name does not match evidence`);
  check(digest === expected.sha256, `${expected.format} hash does not match post-staple evidence`);
  return digest;
};
const dmgDigest = await verifyArtifact(dmgPath, evidence.artifacts.dmg);
const zipDigest = await verifyArtifact(zipPath, evidence.artifacts.zip);
for (const reference of results.flatMap((result) => result.evidenceReferences ?? [])) { try { await access(reference); } catch { failures.push(`evidence file does not exist: ${reference}`); } }
if (failures.length) { failures.forEach((failure) => console.error(`FAIL: ${failure}`)); process.exit(1); }

const runNative = (executable, args, timeout = 10 * 60_000) => {
  const result = spawnSync(executable, args, { cwd: process.cwd(), env: process.env, stdio: "inherit", timeout });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${executable} failed with exit code ${result.status}`);
};
runNative("bash", ["scripts/verify-macos-signing.sh", appPath, dmgPath]);
for (const script of [
  "scripts/macos-notarization-production-smoke-test.mjs",
  "scripts/verify-electron-packaging.mjs",
  "scripts/electron-security-smoke-test.mjs",
  "scripts/meeting-contract-suite.mjs",
  "scripts/meeting-device-permission-recovery-smoke.mjs",
  "scripts/meeting-production-screen-share-smoke.mjs",
  "scripts/screen-share-picker-bridge-full-mvp-smoke.mjs",
  "scripts/screen-share-publish-render-full-mvp-smoke.mjs",
]) runNative(process.execPath, [script]);
console.log(`NATIVE PASS: Task 580 certified post-staple DMG ${dmgDigest.slice(0, 12)}... and ZIP ${zipDigest.slice(0, 12)}... on the recorded macOS x64 machine.`);
