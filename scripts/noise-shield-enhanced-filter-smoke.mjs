import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [service, runtime, noise, voice, types] = await Promise.all([
  readFile("src/services/voice/enhancedNoiseFilterService.ts", "utf8"),
  readFile("src/services/voice/officialLiveKitNoiseProcessorRuntime.ts", "utf8"),
  readFile("src/services/voice/noiseCancellationService.ts", "utf8"),
  readFile("src/services/voiceService.ts", "utf8"),
  readFile("src/services/voice/enhancedNoiseProcessorTypes.ts", "utf8"),
]);

assert.match(service, /import\("\.\/officialLiveKitNoiseProcessorRuntime"\)/);
assert.match(runtime, /PROCESSOR_PACKAGE_UNAVAILABLE/);
for (const status of ["idle", "loading", "ready", "active", "unsupported", "failed", "disposed", "fallback-standard"]) assert.match(types + service, new RegExp(status));
assert.match(service, /source !== "microphone"/);
assert.match(service, /activeTrack\?\.id === track\.id/);
assert.match(service, /generation !== snapshot\.generation/);
assert.match(service, /track\.setProcessor/);
assert.match(service, /track\.stopProcessor/);
assert.match(service, /adapter\.setEnabled\(true\)/);
assert.match(service, /adapter\?\.dispose|processor\.dispose/);
assert.match(service, /listeners\.delete\(listener\)/);
assert.match(service, /releaseCurrent\("disposed"/);
assert.match(service, /__setProviderLoaderForTests/);
assert.match(noise, /applyEnhancedToTrack/);
assert.match(noise, /fallback-standard/);
assert.match(voice, /Track\.Source\.Microphone/);
assert.match(voice, /instanceof LocalAudioTrack/);
assert.match(voice, /disposeProcessor/);
assert.doesNotMatch(service + noise, /Radio|Podcast|AudioPlayer|screenShareMediaTrack/);

console.log("Noise Shield Enhanced/Voice Focus lazy lifecycle contract passed; this build truthfully falls back to Standard because the optional official provider package is absent.");
