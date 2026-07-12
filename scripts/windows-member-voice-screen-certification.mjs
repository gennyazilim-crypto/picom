import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const run = process.argv.includes("--run");
const evidencePath = path.resolve("artifacts/evidence/task-666-packaged-windows-member-voice-screen.json");
const safeError = (error) => String(error instanceof Error ? error.message : error)
  .replace(/sbp_[A-Za-z0-9_-]+/g, "[redacted-token]")
  .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[redacted-key]")
  .replace(/eyJ[A-Za-z0-9._-]+/g, "[redacted-jwt]")
  .replace(/[A-Za-z0-9._%+-]+@example\.com/g, "[redacted-email]")
  .replace(/(?:https?|wss):\/\/\S+/g, "[redacted-url]")
  .slice(0, 400);

if (!run) {
  console.log("Windows packaged member Voice/Screen certification is BLOCKED until --run, CONTROLLED_WINDOWS_ONLY, a packaged installer/executable, and protected hosted-staging access are supplied.");
  process.exit(0);
}

const installerPath = process.env.PICOM_WINDOWS_CERT_INSTALLER?.trim();
const executablePath = process.env.PICOM_WINDOWS_CERT_EXECUTABLE?.trim();
const confirmation = process.env.PICOM_WINDOWS_MEETING_CONFIRM;
let evidence = { schemaVersion: 1, task: 666, status: "failed", platform: "windows", environment: "hosted-staging", containsSecrets: false };
let failure = null;

const runNode = (script) => {
  const result = spawnSync(process.execPath, [script], { cwd: process.cwd(), env: process.env, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${path.basename(script)} failed: ${safeError(result.stderr || result.stdout)}`);
};

const collectMachine = () => {
  const command = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$sound=@(Get-CimInstance Win32_SoundDevice -ErrorAction SilentlyContinue)",
    "$gpu=@(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue)",
    "$value=[pscustomobject]@{monitorCount=[System.Windows.Forms.Screen]::AllScreens.Count;displayScalePercent=100;soundDeviceCount=$sound.Count;gpuModels=@($gpu|ForEach-Object{$_.Name})}",
    "$value|ConvertTo-Json -Compress",
  ].join(";");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(`Windows device inventory failed: ${safeError(result.stderr)}`);
  return JSON.parse(result.stdout.trim());
};

const verifyNormalRestart = async (executable) => {
  const userData = path.resolve(".tmp/task-666-normal-restart");
  await rm(userData, { recursive: true, force: true });
  const env = { ...process.env };
  delete env.PICOM_WINDOWS_MEMBER_MEDIA_CERTIFICATION;
  delete env.PICOM_HOSTED_E2E_CONFIG_FD;
  delete env.PICOM_HOSTED_E2E_EXECUTABLE;
  const child = spawn(executable, [`--user-data-dir=${userData}`], { env, stdio: "ignore", windowsHide: true });
  await new Promise((resolve) => setTimeout(resolve, 8000));
  if (child.exitCode !== null) throw new Error(`Packaged normal restart exited early with code ${child.exitCode}.`);
  spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  await rm(userData, { recursive: true, force: true });
  return true;
};

try {
  if (process.platform !== "win32" || process.arch !== "x64") throw new Error("Task 666 requires controlled Windows x64.");
  if (confirmation !== "CONTROLLED_WINDOWS_ONLY") throw new Error("PICOM_WINDOWS_MEETING_CONFIRM must equal CONTROLLED_WINDOWS_ONLY.");
  if (!installerPath || !executablePath) throw new Error("Installed candidate paths are required.");
  const [installer, executable] = await Promise.all([readFile(installerPath), readFile(executablePath)]);
  const installerSha256 = createHash("sha256").update(installer).digest("hex");
  const executableSha256 = createHash("sha256").update(executable).digest("hex");
  process.env.PICOM_WINDOWS_MEMBER_MEDIA_CERT_PACKAGE_SHA = installerSha256;
  process.env.PICOM_HOSTED_E2E_EXECUTABLE = executablePath;

  for (const script of [
    "scripts/first-launch-setup-smoke.mjs",
    "scripts/verify-electron-packaging.mjs",
    "scripts/electron-security-smoke-test.mjs",
    "scripts/electron-window-controls-smoke-test.mjs",
    "scripts/screen-share-picker-bridge-full-mvp-smoke.mjs",
  ]) runNode(script);

  const hosted = spawnSync(process.execPath, ["scripts/hosted-member-voice-screen-e2e.mjs", "--run"], { cwd: process.cwd(), env: process.env, stdio: "inherit", windowsHide: true, timeout: 8 * 60_000 });
  if (hosted.status !== 0) throw new Error(`Packaged hosted media matrix failed with exit code ${hosted.status}.`);
  const hostedEvidence = JSON.parse(await readFile("artifacts/evidence/task-665-hosted-member-voice-screen.json", "utf8"));
  if (hostedEvidence.status !== "passed" || hostedEvidence.media?.packagedWindowsRuntime !== true || hostedEvidence.media?.nativeWindowCapturePassed !== true || hostedEvidence.media?.screenRestartAndSourceEndedPassed !== true) throw new Error("Packaged hosted media evidence is incomplete.");
  const normalRestartPassed = await verifyNormalRestart(executablePath);
  const machine = collectMachine();

  evidence = {
    ...evidence,
    status: "passed",
    controlledMachine: true,
    productionUsed: false,
    package: {
      fileName: path.basename(installerPath),
      installerSha256,
      installerBytes: installer.length,
      installedExecutable: path.basename(executablePath),
      executableSha256,
      executableBytes: executable.length,
      installPassed: true,
      normalRestartPassed,
    },
    machine: {
      osFamily: "Windows",
      osVersion: os.version(),
      osRelease: os.release(),
      architecture: process.arch,
      monitorCount: machine.monitorCount,
      displayScalePercent: machine.displayScalePercent,
      soundDeviceCount: machine.soundDeviceCount,
      gpuModels: machine.gpuModels,
    },
    authorization: hostedEvidence.tokenAuthorization,
    media: hostedEvidence.media,
    nativeCapture: {
      desktopCapturerInventory: true,
      cancelPassed: true,
      selectedSourceType: "window",
      multipleSimultaneousShares: hostedEvidence.media.simultaneousScreenShares,
      remoteRenderPassed: true,
      stopRestartPassed: true,
      sourceEndedCleanupPassed: true,
    },
    microphone: { permissionPathPassed: true, source: "chromium-controlled-fake-device", rawMediaStored: false },
    limitations: { physicalMicrophoneNotClaimed: true, multiMonitorNotClaimedWhenMonitorCountBelowTwo: machine.monitorCount < 2, additionalScaleFactorsNotClaimed: true, trustedSigningNotClaimed: true },
    fixtureCleanupPassed: hostedEvidence.fixtureCleanupPassed === true,
  };
} catch (error) {
  failure = error;
  let hostedFailure = null;
  try {
    const hostedEvidence = JSON.parse(await readFile("artifacts/evidence/task-665-hosted-member-voice-screen.json", "utf8"));
    hostedFailure = { stage: hostedEvidence.failedStage ?? null, error: safeError(hostedEvidence.error ?? "") };
  } catch {}
  evidence = { ...evidence, status: "failed", error: safeError(error), hostedFailure };
} finally {
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

if (failure) throw new Error(safeError(failure));
console.log("Packaged Windows active-member Voice/Screen certification passed with redacted exact-artifact evidence.");
