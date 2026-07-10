import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync("src/utils/voiceQualityMetrics.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { getVoiceDurationBucket, normalizeVoiceConnectionQuality } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

assert.equal(normalizeVoiceConnectionQuality("excellent"), "excellent");
assert.equal(normalizeVoiceConnectionQuality("GOOD"), "good");
assert.equal(normalizeVoiceConnectionQuality("unexpected"), "unknown");
assert.equal(getVoiceDurationBucket(null), "none");
assert.equal(getVoiceDurationBucket(30_000), "under_1m");
assert.equal(getVoiceDurationBucket(2 * 60_000), "1m_to_5m");
assert.equal(getVoiceDurationBucket(10 * 60_000), "5m_to_30m");
assert.equal(getVoiceDurationBucket(31 * 60_000), "30m_plus");

const voice = readFileSync("src/services/voiceService.ts", "utf8");
for (const marker of ["ConnectionQualityChanged", "reconnectCount", "joinFailureCount", "deviceErrorCount", "getDiagnosticsSummary"]) {
  assert.ok(voice.includes(marker), `missing voice quality marker: ${marker}`);
}
for (const forbidden of ["MediaRecorder", "audioBlob", "recordingData"]) {
  assert.ok(!voice.includes(forbidden), `voice diagnostics must not record audio: ${forbidden}`);
}

console.log("Voice quality metrics tests passed.");
