import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const source = readFileSync(resolve(root, "src/utils/screenShareQuality.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const quality = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

assert.deepEqual(quality.screenShareQualityPresets.map((preset) => preset.id), ["presentation", "balanced", "performance"]);
assert.equal(quality.getScreenShareQualityPreset("balanced").width, 1280);
assert.equal(quality.getScreenShareTrackConstraints("performance").frameRate.max, 15);

const picker = readFileSync(resolve(root, "src/components/voice/ScreenSharePicker.tsx"), "utf8");
const voice = readFileSync(resolve(root, "src/services/voiceService.ts"), "utf8");
for (const marker of ["screenShareQualityPresets", "qualityPreset", "Share quality"]) assert.ok(picker.includes(marker), `Missing picker marker: ${marker}`);
for (const marker of ["getScreenShareTrackConstraints", "applyConstraints", 'preset: ScreenShareQualityPresetId = "balanced"']) assert.ok(voice.includes(marker), `Missing voice marker: ${marker}`);

console.log("Screen share quality preset tests passed.");
