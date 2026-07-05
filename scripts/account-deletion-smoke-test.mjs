import { readFileSync } from "node:fs";

const service = readFileSync("src/services/accountDeletionService.ts", "utf8");
const settings = readFileSync("src/components/SettingsModal.tsx", "utf8");

const failures = [];

for (const pattern of [/hardDelete/i, /deleteUser\(/i, /removeUser/i, /access_token/i, /refresh_token/i, /authorization/i, /console\.(log|warn|error|info)/]) {
  if (pattern.test(service)) {
    failures.push(`accountDeletionService includes an unsafe destructive or sensitive pattern: ${pattern}`);
  }
}

if (!service.includes("requestDeletionPlaceholder")) {
  failures.push("accountDeletionService should expose requestDeletionPlaceholder().");
}

if (!service.includes("cancelDeletionPlaceholder")) {
  failures.push("accountDeletionService should expose cancelDeletionPlaceholder().");
}

if (!settings.includes("Danger Zone")) {
  failures.push("Settings > Account should include a Danger Zone.");
}

if (!settings.includes("Request deletion placeholder")) {
  failures.push("Settings > Account should include the request deletion placeholder button.");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Account deletion placeholder smoke passed.");