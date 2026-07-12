import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";

const valueAfter = (name) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; };
const run = process.argv.includes("--run");
const appImagePath = valueAfter("--appimage");
const debPath = valueAfter("--deb");
const evidencePath = valueAfter("--evidence") ?? "docs/evidence/task-579-linux-meeting.json";
const [matrix, evidence] = await Promise.all([
  readFile("tests/native/linux-meeting-certification-matrix.json", "utf8").then(JSON.parse),
  readFile(evidencePath, "utf8").then(JSON.parse),
]);
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const statuses = new Set(["PASS", "FAIL", "BLOCKED"]);

check(matrix.schemaVersion === 1 && matrix.task === 579, "matrix identity is invalid");
check(matrix.platform === "linux" && JSON.stringify(matrix.supportedArchitectures) === JSON.stringify(["x64"]), "Linux x64 boundary is invalid");
check(JSON.stringify(matrix.requiredPackages) === JSON.stringify(["appimage", "deb"]), "AppImage/DEB package boundary is invalid");
check(JSON.stringify(matrix.requiredSessions) === JSON.stringify(["wayland", "x11"]), "Wayland/X11 session boundary is invalid");
check(matrix.nativeBuildRequired === true && matrix.remoteClientRequired === true && matrix.productionAllowed === false, "native/remote safety boundary is missing");
check(matrix.requiredConfirmation === "NATIVE_LINUX_ONLY", "native confirmation is invalid");
const flows = Array.isArray(matrix.flows) ? matrix.flows : [];
check(flows.length === 23 && new Set(flows.map((flow) => flow.id)).size === flows.length, "23 unique Linux flows are required");

check(evidence.schemaVersion === 1 && evidence.task === 579, "evidence identity is invalid");
check(evidence.platform === "linux" && statuses.has(evidence.executionStatus), "evidence platform or status is invalid");
check(evidence.productionUsed === false && evidence.nativeLinuxUsed === (evidence.executionStatus === "PASS"), "native Linux declaration is inconsistent");
check(evidence.windowsCrossBuildAccepted === false, "Windows cross-build must never count as Linux proof");
check(evidence.privateDataCaptured === false && evidence.rawMediaStored === false && evidence.redactionReviewed === true, "evidence privacy declaration is invalid");
const results = Array.isArray(evidence.flowResults) ? evidence.flowResults : [];
check(results.length === flows.length, "evidence must cover every Linux flow");
for (const flow of flows) {
  const result = results.find((item) => item.id === flow.id);
  check(Boolean(result), `evidence missing ${flow.id}`);
  if (!result) continue;
  check(statuses.has(result.status), `${flow.id} status is invalid`);
  check(typeof result.reasonCode === "string" && /^[a-z0-9_]{3,100}$/.test(result.reasonCode), `${flow.id} reasonCode is invalid`);
  check(Array.isArray(result.evidenceReferences), `${flow.id} evidenceReferences is invalid`);
  for (const reference of result.evidenceReferences ?? []) check(typeof reference === "string" && reference.startsWith("docs/evidence/task-579/") && !path.isAbsolute(reference) && !reference.includes(".."), `${flow.id} evidence reference is unsafe`);
  if (run) {
    check(result.status === "PASS", `${flow.id} must pass for Linux certification`);
    check(result.evidenceReferences.length > 0, `${flow.id} pass requires redacted evidence`);
  }
}

const forbiddenKey = /password|secret|access.?token|refresh.?token|service.?role|private.?key|authorization|credential|connection.?string|serial.?number/i;
const inspect = (value, location = "evidence") => {
  if (Array.isArray(value)) return value.forEach((item, index) => inspect(item, `${location}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) { if (forbiddenKey.test(key)) failures.push(`${location}.${key} is forbidden in evidence`); inspect(child, `${location}.${key}`); }
};
inspect(evidence);

if (run) {
  check(process.platform === "linux", "native certification must run on Linux");
  check(process.env.PICOM_LINUX_MEETING_CONFIRM === "NATIVE_LINUX_ONLY", "PICOM_LINUX_MEETING_CONFIRM must equal NATIVE_LINUX_ONLY");
  check(evidence.executionStatus === "PASS" && evidence.nativeLinuxUsed === true, "native Linux execution must be PASS");
  check(evidence.machine?.architecture === "x64" && evidence.machine?.distroName && evidence.machine?.distroVersion, "Linux distro/x64 inventory is missing");
  check(evidence.machine?.desktopEnvironment && evidence.machine?.kernelVersion, "desktop/kernel inventory is missing");
  check(evidence.machine?.pipeWireVersion && evidence.machine?.portalBackend && evidence.machine?.audioStack, "PipeWire/portal/audio inventory is missing");
  check(Number.isInteger(evidence.machine?.monitorCount) && evidence.machine.monitorCount >= 1, "monitor count is missing");
  for (const field of ["cameraModels", "microphoneModels", "speakerModels", "gpuModels"]) check(Array.isArray(evidence.machine?.[field]) && evidence.machine[field].length > 0, `${field} inventory is missing`);
  const sessionRuns = Array.isArray(evidence.sessionRuns) ? evidence.sessionRuns : [];
  for (const session of matrix.requiredSessions) check(sessionRuns.some((item) => item.sessionType === session && item.status === "PASS" && item.portalScreenShareStatus === "PASS"), `${session} portal session is not certified`);
  check(evidence.remoteClient?.status === "PASS" && evidence.remoteClient?.distinctClientConfirmed === true, "distinct remote client is not proven");
  for (const packageName of matrix.requiredPackages) {
    const artifact = evidence.artifacts?.[packageName];
    check(artifact?.builtOnLinux === true && typeof artifact?.sha256 === "string" && /^[a-f0-9]{64}$/.test(artifact.sha256), `${packageName} native artifact/hash is invalid`);
  }
  check(typeof appImagePath === "string" && appImagePath.length > 0, "--appimage is required");
  check(typeof debPath === "string" && debPath.length > 0, "--deb is required");
}

if (failures.length) { failures.forEach((failure) => console.error(`FAIL: ${failure}`)); process.exit(1); }
if (!run) {
  console.log(`CONTRACT PASS: Task 579 defines ${flows.length} native Linux x64 AppImage/DEB meeting flows across Wayland and X11.`);
  console.log(`NATIVE EXECUTION ${evidence.executionStatus}: no Linux package, portal, device, remote client, or media was accessed; Windows output was not accepted.`);
  process.exit(0);
}

const verifyArtifact = async (filePath, expected) => {
  const bytes = await readFile(filePath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  check(path.basename(filePath) === expected.fileName, `${expected.format} file name does not match evidence`);
  check(digest === expected.sha256, `${expected.format} hash does not match evidence`);
  return digest;
};
const appImageDigest = await verifyArtifact(appImagePath, evidence.artifacts.appimage);
const debDigest = await verifyArtifact(debPath, evidence.artifacts.deb);
const appImageMode = (await stat(appImagePath)).mode;
check((appImageMode & 0o111) !== 0, "AppImage is not executable");
for (const reference of results.flatMap((result) => result.evidenceReferences ?? [])) { try { await access(reference); } catch { failures.push(`evidence file does not exist: ${reference}`); } }
if (failures.length) { failures.forEach((failure) => console.error(`FAIL: ${failure}`)); process.exit(1); }

const runNative = (executable, args, timeout = 10 * 60_000) => {
  const result = spawnSync(executable, args, { cwd: process.cwd(), env: process.env, stdio: "inherit", timeout });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${executable} failed with exit code ${result.status}`);
};
runNative("dpkg-deb", ["--info", debPath]);
for (const script of [
  "scripts/verify-electron-packaging.mjs",
  "scripts/linux-repository-distribution-smoke-test.mjs",
  "scripts/electron-security-smoke-test.mjs",
  "scripts/meeting-contract-suite.mjs",
  "scripts/meeting-device-permission-recovery-smoke.mjs",
  "scripts/meeting-production-screen-share-smoke.mjs",
  "scripts/screen-share-picker-bridge-full-mvp-smoke.mjs",
  "scripts/screen-share-publish-render-full-mvp-smoke.mjs",
]) runNative(process.execPath, [script]);
console.log(`NATIVE PASS: Task 579 certified AppImage ${appImageDigest.slice(0, 12)}... and DEB ${debDigest.slice(0, 12)}... on recorded Wayland/X11 Linux x64 sessions.`);
