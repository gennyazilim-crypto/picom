import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.join(".tmp", "provenance-smoke");
const output = path.join(root, "provenance.json");
const artifactsDir = path.join(root, "release");

fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(artifactsDir, { recursive: true });
fs.writeFileSync(path.join(artifactsDir, "Picom-0.1.1-beta.1-beta-Linux-x86_64.AppImage"), "artifact-placeholder");

execFileSync(process.execPath, ["scripts/generate-release-provenance.mjs", `--output=${output}`, `--artifacts-dir=${artifactsDir}`], {
  stdio: "pipe",
  env: {
    ...process.env,
    VITE_RELEASE_CHANNEL: "beta",
    VITE_BUILD_DATE: "2026-07-06T00:00:00.000Z",
    VITE_FRONTEND_BUILD_HASH: "smoke-build",
    VITE_API_COMPATIBILITY_VERSION: "mvp-smoke",
  },
});

const raw = fs.readFileSync(output, "utf8");
const provenance = JSON.parse(raw);

for (const [key, expected] of Object.entries({
  productName: "Picom Desktop",
  releaseChannel: "beta",
  buildDate: "2026-07-06T00:00:00.000Z",
  platform: process.platform,
  architecture: process.arch,
  desktopRuntime: "electron",
  frontendBuildHash: "smoke-build",
  backendApiCompatibilityVersion: "mvp-smoke",
})) {
  if (provenance[key] !== expected) {
    throw new Error(`Expected provenance.${key} to equal ${expected}, got ${provenance[key]}`);
  }
}

if (!Array.isArray(provenance.artifacts) || !provenance.artifacts.includes("Picom-0.1.1-beta.1-beta-Linux-x86_64.AppImage")) {
  throw new Error("Provenance output did not include expected artifact list.");
}

if (!Array.isArray(provenance.artifactMetadata) || provenance.artifactMetadata.length !== 1 || !/^[a-f0-9]{64}$/.test(provenance.artifactMetadata[0].sha256) || provenance.artifactMetadata[0].sizeBytes <= 0) {
  throw new Error("Provenance output did not include safe artifact hash/size metadata.");
}

for (const forbidden of ["password", "secret", "service_role", "privateKey", "certificatePassword"]) {
  if (raw.includes(forbidden)) {
    throw new Error(`Provenance output contains forbidden text: ${forbidden}`);
  }
}

for (const [file, expected] of [
  ["src/config/appConfig.ts", "backendApiCompatibilityVersion"],
  ["src/components/SettingsModal.tsx", "About Picom"],
  ["src/services/diagnostics/diagnosticsService.ts", "commitShort"],
]) {
  if (!fs.readFileSync(file, "utf8").includes(expected)) {
    throw new Error(`${file} missing expected provenance marker: ${expected}`);
  }
}

fs.rmSync(root, { recursive: true, force: true });
console.log("Release provenance smoke test passed.");
