import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("dist/.vite/manifest.json", "utf8"));
const entries = Object.entries(manifest);
const providerEntry = entries.find(([key]) => key.includes("officialLiveKitNoiseProcessorRuntime"));
assert.ok(providerEntry, "official Noise Shield runtime must be emitted as a separate manifest entry");

const entryKeys = entries.filter(([, value]) => value.isEntry).map(([key]) => key);
assert.ok(entryKeys.length > 0, "renderer entry chunk missing");

const staticGraph = new Set();
const visitStatic = (key) => {
  if (staticGraph.has(key)) return;
  staticGraph.add(key);
  for (const imported of manifest[key]?.imports ?? []) visitStatic(imported);
};
entryKeys.forEach(visitStatic);
assert.equal(staticGraph.has(providerEntry[0]), false, "optional Noise Shield runtime must not enter the synchronous renderer graph");

const dynamicReferences = new Set(entries.flatMap(([, value]) => value.dynamicImports ?? []));
assert.ok(dynamicReferences.has(providerEntry[0]), "Noise Shield runtime must remain reachable through a dynamic import");

console.log(`Noise Shield lazy chunk contract passed: ${providerEntry[1].file} is dynamic and excluded from the initial graph.`);
