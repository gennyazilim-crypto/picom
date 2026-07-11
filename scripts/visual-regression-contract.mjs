import { access, readFile } from "node:fs/promises";
import path from "node:path";

const manifest = JSON.parse(await readFile("tests/visual/visual-regression-manifest.json", "utf8"));
const requiredScreens = Object.freeze({
  mentionFeed: "src/components/MentionFeedMain.tsx",
  profile: "src/components/ProfileView.tsx",
  communityChat: "src/components/ChatMain.tsx",
  settings: "src/components/SettingsModal.tsx",
  directMessages: "src/components/DirectMessagesView.tsx",
  voice: "src/components/VoiceRoomView.tsx",
  screenShare: "src/components/voice/ScreenSharePreview.tsx",
  radioCommunity: "src/components/audio/RadioCommunityShell.tsx",
  podcastCommunity: "src/components/audio/PodcastCommunityShell.tsx",
  podcastEpisode: "src/components/audio/PodcastEpisodeDetail.tsx",
});
const expectedViewports = Object.freeze({
  default: { width: 1440, height: 900 },
  minimum: { width: 1100, height: 700 },
});
const failures = [];

if (manifest.schemaVersion !== 1) failures.push("schemaVersion must be 1");
if (manifest.blockingMode !== "contract_only") failures.push("screenshot diff must remain contract_only until tuned baselines are approved");
if (manifest.enabled !== false) failures.push("screenshot execution cannot be enabled without Playwright and approved baselines");
if (JSON.stringify(manifest.viewports) !== JSON.stringify(expectedViewports)) failures.push("desktop viewports must remain 1440x900 and 1100x700");
if (manifest.dataSource !== "mock" || manifest.randomness !== "fixed") failures.push("visual data must be deterministic mock data");
if (manifest.reducedMotion !== true) failures.push("reduced motion must be enabled for visual captures");
if (!Array.isArray(manifest.scenarios)) failures.push("scenarios must be an array");

const scenarios = Array.isArray(manifest.scenarios) ? manifest.scenarios : [];
const ids = new Set();
for (const scenario of scenarios) {
  if (typeof scenario.id !== "string" || ids.has(scenario.id)) failures.push(`invalid or duplicate scenario id: ${scenario.id}`); else ids.add(scenario.id);
  const expectedEntry = requiredScreens[scenario.screen];
  if (!expectedEntry) failures.push(`unexpected screen: ${scenario.screen}`);
  if (!["light", "dark"].includes(scenario.theme)) failures.push(`unexpected theme: ${scenario.theme}`);
  if (!Object.hasOwn(expectedViewports, scenario.viewport)) failures.push(`unexpected viewport: ${scenario.viewport}`);
  if (scenario.entryFile !== expectedEntry) failures.push(`${scenario.id} must reference ${expectedEntry}`);
  if (typeof scenario.entryFile !== "string" || path.isAbsolute(scenario.entryFile) || scenario.entryFile.includes("\\")) failures.push(`${scenario.id} entryFile must be a portable repository-relative path`);
  else {
    try { await access(scenario.entryFile); } catch { failures.push(`${scenario.id} entryFile does not exist: ${scenario.entryFile}`); }
  }
}

for (const screen of Object.keys(requiredScreens)) {
  for (const theme of ["light", "dark"]) {
    if (!scenarios.some((scenario) => scenario.screen === screen && scenario.theme === theme && scenario.viewport === "default")) failures.push(`missing ${screen} ${theme} default scenario`);
  }
}
for (const theme of ["light", "dark"]) if (!scenarios.some((scenario) => scenario.screen === "communityChat" && scenario.theme === theme && scenario.viewport === "minimum")) failures.push(`missing communityChat ${theme} minimum desktop scenario`);
if (scenarios.some((scenario) => /mobile|phone|tablet/i.test(`${scenario.id} ${scenario.screen} ${scenario.viewport}`))) failures.push("mobile scenarios are outside Picom scope");

if (failures.length) { for (const failure of failures) console.error(`FAIL: ${failure}`); process.exit(1); }
console.log(`PASS: visual regression contract covers ${scenarios.length} stable desktop light/dark scenarios across default and minimum viewports.`);
console.log("INFO: pixel screenshot execution is intentionally non-blocking until Playwright and per-platform baselines are tuned.");
