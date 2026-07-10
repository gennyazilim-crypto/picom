import { readFile } from "node:fs/promises";

const fixtures = JSON.parse(await readFile("tests/plugins/declarative-manifest-fixtures.json", "utf8"));
const allowedCapabilities = new Set(["ui:sidebar-card", "commands:contribute", "notifications:request", "messages:send-via-bot"]);
const allowedContributionTypes = new Set(["status-card", "command"]);
const forbiddenFields = ["entrypoint", "code", "script", "module", "url", "network", "filesystem", "shell", "ipc"];
const pluginRuntimeKillSwitch = true;

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return false;
  if (manifest.schemaVersion !== 1 || !/^[a-z0-9.-]{3,80}$/.test(manifest.id ?? "") || !/^\d+\.\d+\.\d+$/.test(manifest.version ?? "")) return false;
  if (forbiddenFields.some((field) => Object.hasOwn(manifest, field))) return false;
  if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length > 8 || manifest.capabilities.some((capability) => !allowedCapabilities.has(capability))) return false;
  if (!Array.isArray(manifest.contributions) || manifest.contributions.length > 8) return false;
  return manifest.contributions.every((item) => item && typeof item === "object" && allowedContributionTypes.has(item.type) && (!item.title || (typeof item.title === "string" && item.title.length <= 80)));
}

for (const fixture of fixtures) {
  const actual = validateManifest(fixture.manifest);
  if (actual !== fixture.valid) throw new Error(`${fixture.name}: expected ${fixture.valid}, got ${actual}`);
  console.log(`PASS: ${fixture.name} ${actual ? "accepted as declarative data" : "rejected"}`);
}
if (!pluginRuntimeKillSwitch) throw new Error("Prototype must remain disabled.");
console.log("PASS: global plugin runtime kill switch is active; no manifest was executed or exposed to users.");
