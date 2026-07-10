import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("tests/visual/visual-regression-manifest.json", "utf8"));
const requiredScreens = ["mentionFeed", "profile", "communityChat", "settings", "voice"];
const failures = [];

if (manifest.schemaVersion !== 1) failures.push("schemaVersion must be 1");
if (manifest.blockingMode !== "contract_only") failures.push("screenshot diff must remain contract_only until tuned baselines are approved");
if (manifest.enabled !== false) failures.push("screenshot execution cannot be enabled without Playwright and approved baselines");
if (manifest.viewport?.width !== 1440 || manifest.viewport?.height !== 900) failures.push("desktop viewport must remain 1440x900");
if (manifest.dataSource !== "mock" || manifest.randomness !== "fixed") failures.push("visual data must be deterministic mock data");
if (manifest.reducedMotion !== true) failures.push("reduced motion must be enabled for visual captures");
if (!Array.isArray(manifest.scenarios)) failures.push("scenarios must be an array");

const scenarios = Array.isArray(manifest.scenarios) ? manifest.scenarios : [];
const ids = new Set();
for (const scenario of scenarios) {
  if (typeof scenario.id !== "string" || ids.has(scenario.id)) failures.push(`invalid or duplicate scenario id: ${scenario.id}`); else ids.add(scenario.id);
  if (!requiredScreens.includes(scenario.screen)) failures.push(`unexpected screen: ${scenario.screen}`);
  if (!['light', 'dark'].includes(scenario.theme)) failures.push(`unexpected theme: ${scenario.theme}`);
}
for (const screen of requiredScreens) for (const theme of ["light", "dark"]) if (!scenarios.some((scenario) => scenario.screen === screen && scenario.theme === theme)) failures.push(`missing ${screen} ${theme} scenario`);
if (scenarios.some((scenario) => /mobile|phone|tablet/i.test(`${scenario.id} ${scenario.screen}`))) failures.push("mobile scenarios are outside Picom scope");

if (failures.length) { for (const failure of failures) console.error(`FAIL: ${failure}`); process.exit(1); }
console.log(`PASS: visual regression contract covers ${scenarios.length} stable desktop light/dark scenarios.`);
console.log("INFO: pixel screenshot execution is intentionally non-blocking until Playwright and per-platform baselines are tuned.");
