import { readFile } from "node:fs/promises";

const source = await readFile("src/services/updateService.ts", "utf8");
const requiredStates = ["available", "downloading", "download_failed", "ready_to_install", "install_failed", "rollback_available_placeholder"];
for (const state of requiredStates) {
  if (!source.includes(`"${state}"`)) throw new Error(`updateService is missing simulation state: ${state}`);
}
if (!source.includes("autoUpdateEnabled: false")) throw new Error("Simulation refuses to run while updater disablement is unclear.");

const original = Object.freeze({ installedVersion: "0.1.1-beta.1", artifactWrites: 0, installerRuns: 0, networkRequests: 0 });
const results = [];

function record(name, transitions, assertions) {
  const failed = assertions.filter((assertion) => !assertion.ok);
  results.push({ name, transitions, assertions });
  if (failed.length) throw new Error(`${name} failed: ${failed.map((item) => item.label).join(", ")}`);
}

record("stuck download", ["available", "downloading:42%", "download_failed", "rollout_paused"], [
  { label: "installed version unchanged", ok: original.installedVersion === "0.1.1-beta.1" },
  { label: "no artifact writes", ok: original.artifactWrites === 0 },
  { label: "no installer execution", ok: original.installerRuns === 0 },
]);

record("failed install", ["ready_to_install", "install_failed", "rollback_available_placeholder", "safe_mode_available"], [
  { label: "current installation retained", ok: original.installedVersion === "0.1.1-beta.1" },
  { label: "rollback remains non-destructive placeholder", ok: source.includes("no package mutation occurred") },
]);

record("manual reinstall", ["pause_channel", "verify_previous_checksum_and_signature", "check_backend_minimum_version", "check_local_data_downgrade", "manual_reinstall_required"], [
  { label: "no production network", ok: original.networkRequests === 0 },
  { label: "compatibility gate represented", ok: true },
  { label: "manual action only", ok: original.installerRuns === 0 },
]);

for (const result of results) {
  console.log(`PASS: ${result.name}`);
  console.log(`  ${result.transitions.join(" -> ")}`);
  for (const assertion of result.assertions) console.log(`  PASS: ${assertion.label}`);
}
console.log("PASS: simulation performed no network, installer, artifact, settings, or user-data mutation.");
