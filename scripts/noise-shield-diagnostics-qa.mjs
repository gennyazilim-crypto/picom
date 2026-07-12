import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const diagnostics = read("src/services/voice/noiseShieldDiagnosticsService.ts");
const panel = read("src/components/voice/NoiseShieldControl.tsx");
const lifecycle = read("src/services/voice/microphoneTrackLifecycleService.ts");
const processing = read("src/services/voice/noiseCancellationService.ts");

for (const field of [
  "requestedMode",
  "appliedMode",
  "supportedConstraints",
  "appliedTrackSettings",
  "processorState",
  "processorInitializationDurationMs",
  "inputDeviceKey",
  "fallbackReason",
  "errorCode",
  "cpuApproximation",
  "rendererMemoryBucket",
]) assert.match(diagnostics, new RegExp(`\\b${field}\\b`), `Missing safe diagnostics field: ${field}`);

assert.match(diagnostics, /rawAudioCaptured:\s*false/);
assert.match(diagnostics, /rawWaveformExported:\s*false/);
assert.match(diagnostics, /deviceLabelIncluded:\s*false/);
assert.match(diagnostics, /fullDeviceIdIncluded:\s*false/);
assert.doesNotMatch(diagnostics, /MediaRecorder|AudioBuffer|createMediaStreamSource|getUserMedia\(/);
assert.doesNotMatch(panel, /MediaRecorder|URL\.createObjectURL|download\s*=/i);
assert.match(panel, /Support diagnostics/);
assert.match(panel, /No raw audio, waveform, full device identifier/);
assert.match(lifecycle, /MAX_SAFE_EVENTS\s*=\s*64/);
assert.match(lifecycle, /source !== "microphone"/);
assert.match(processing, /fallback-standard/);
assert.match(processing, /processorInitializationDurationMs/);

const contracts = [
  "noise-shield-standard-processing-smoke.mjs",
  "noise-shield-enhanced-filter-smoke.mjs",
  "noise-shield-settings-controls-smoke.mjs",
  "noise-shield-track-lifecycle-smoke.mjs",
  "audio-player-smoke.mjs",
];

for (const contract of contracts) {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", contract)], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, `${contract} failed:\n${result.stderr || result.stdout}`);
}

console.log("Noise Shield privacy-safe diagnostics and acoustic QA harness passed.");
