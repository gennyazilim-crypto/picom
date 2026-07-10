import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("tests/e2e/e2e-coverage-manifest.json", "utf8"));
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const requiredFlows = ["auth-login-register", "community-join", "message-send", "attachment-upload", "mention-feed", "full-profile", "voice-room"];
const failures = [];

if (manifest.schemaVersion !== 1) failures.push("schemaVersion must be 1");
if (manifest.runnerStatus !== "planned") failures.push("runnerStatus cannot claim implementation before a real UI E2E runner exists");
if (manifest.productionAllowed !== false) failures.push("production E2E targeting must remain disabled");
if (JSON.stringify(manifest.allowedModes) !== JSON.stringify(["mock", "staging"])) failures.push("only separated mock/staging modes are allowed");
if (!Array.isArray(manifest.flows)) failures.push("flows must be an array");

const flows = Array.isArray(manifest.flows) ? manifest.flows : [];
for (const id of requiredFlows) if (!flows.some((flow) => flow.id === id)) failures.push(`missing core E2E flow: ${id}`);
for (const flow of flows) {
  if (!requiredFlows.includes(flow.id)) failures.push(`unexpected flow: ${flow.id}`);
  if (flow.mockUi !== "planned" || flow.stagingUi !== "planned") failures.push(`${flow.id} cannot claim UI automation before runner activation`);
  if (!Array.isArray(flow.preflightCommands) || !flow.preflightCommands.length) failures.push(`${flow.id} needs preflight commands`);
  for (const command of flow.preflightCommands ?? []) if (typeof packageJson.scripts?.[command] !== "string") failures.push(`${flow.id} references missing npm command: ${command}`);
}
if (JSON.stringify(manifest.desktopPlatforms) !== JSON.stringify(["windows", "linux", "macos"])) failures.push("desktop platform coverage must include Windows, Linux and macOS");

if (failures.length) { for (const failure of failures) console.error(`FAIL: ${failure}`); process.exit(1); }
console.log(`PASS: E2E coverage contract maps ${flows.length} core flows to existing preflight checks and separate mock/staging plans.`);
console.log("INFO: no UI E2E execution is claimed; Playwright/Electron runner activation remains pending.");
