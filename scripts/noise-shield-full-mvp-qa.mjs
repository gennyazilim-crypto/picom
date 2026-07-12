import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const requireFile = (relative) => assert.equal(fs.existsSync(path.join(root, relative)), true, `Required Noise Shield evidence is missing: ${relative}`);

for (const file of [
  "docs/noise-shield-capability-audit.md",
  "docs/noise-shield-architecture.md",
  "docs/noise-shield-ui-contract.md",
  "docs/noise-shield-track-lifecycle.md",
  "docs/noise-shield-acoustic-qa-plan.md",
  "docs/noise-shield-performance-report.md",
  "src/services/voice/noiseCancellationService.ts",
  "src/services/voice/enhancedNoiseFilterService.ts",
  "src/services/voice/microphoneTrackLifecycleService.ts",
  "src/services/voice/noiseShieldDiagnosticsService.ts",
  "src/components/voice/NoiseShieldControl.tsx",
]) requireFile(file);

const processing = read("src/services/voice/noiseCancellationService.ts");
const enhanced = read("src/services/voice/enhancedNoiseFilterService.ts");
const lifecycle = read("src/services/voice/microphoneTrackLifecycleService.ts");
const diagnostics = read("src/services/voice/noiseShieldDiagnosticsService.ts");
const controls = read("src/components/voice/NoiseShieldControl.tsx");
const styles = read("src/components/voice/NoiseShieldControl.css");
const voice = read("src/services/voiceService.ts");

for (const mode of ["off", "standard", "enhanced", "voice-focus"]) {
  assert.match(controls, new RegExp(`["']${mode}["']`), `UI mode is missing: ${mode}`);
}
assert.match(processing, /createMicrophoneCapturePlan/);
assert.match(processing, /createBasicFallback/);
assert.match(processing, /fallback-standard/);
assert.match(enhanced, /import\("\.\/officialLiveKitNoiseProcessorRuntime"\)/);
assert.match(enhanced, /source !== "microphone"/);
assert.match(lifecycle, /source !== "microphone"/);
assert.match(lifecycle, /duplicate_attach_prevented/);
assert.match(lifecycle, /duplicate_processor_prevented/);
assert.match(lifecycle, /beforeunload/);
assert.match(voice, /"device_switch"/);
assert.match(voice, /"reconnect"/);
assert.match(voice, /"room_cleanup"/);
assert.match(diagnostics, /rawAudioCaptured:\s*false/);
assert.match(diagnostics, /fullDeviceIdIncluded:\s*false/);
assert.doesNotMatch(diagnostics, /MediaRecorder|getUserMedia\(|AudioBuffer/);
assert.match(controls, /role="radiogroup"/);
assert.match(controls, /aria-live="polite"/);
assert.match(controls, /Voice Focus:/);
assert.match(styles, /prefers-reduced-motion:\s*reduce/);
assert.match(styles, /focus-visible/);

const contracts = [
  "noise-shield-diagnostics-qa.mjs",
  "voice-device-selection-smoke.mjs",
  "voice-audio-settings-full-mvp-smoke.mjs",
  "voice-reconnect-recovery-smoke.mjs",
  "voice-devices-reconnect-full-mvp-smoke.mjs",
  "voice-room-client-full-mvp-smoke.mjs",
  "voice-mini-card-production-smoke.mjs",
  "livekit-smoke-test.mjs",
  "livekit-token-security-smoke.mjs",
  "visual-regression-contract.mjs",
  "e2e-coverage-contract.mjs",
  "license-notices-smoke-test.mjs",
];

for (const contract of contracts) {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", contract)], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, `${contract} failed:\n${result.stderr || result.stdout}`);
}

console.log("Noise Shield Full MVP local QA contracts passed.");
console.log("Native acoustic certification: BLOCKED until Windows/Linux/macOS hardware runs are recorded.");
console.log("Hosted two-client certification: BLOCKED until a protected LiveKit staging environment is available.");
