import { readFileSync } from "node:fs";

const service = readFileSync("src/services/sessionManagementService.ts", "utf8");
const settings = readFileSync("src/components/SettingsModal.tsx", "utf8");

const forbiddenServicePatterns = [
  /access_token/i,
  /refresh_token/i,
  /authorization/i,
  /tokenHash/i,
  /console\.(log|warn|error|info)/,
];

const failures = [];

for (const pattern of forbiddenServicePatterns) {
  if (pattern.test(service)) {
    failures.push(`sessionManagementService exposes or logs a forbidden token/header pattern: ${pattern}`);
  }
}

if (!service.includes("getActiveSessions")) {
  failures.push("sessionManagementService must expose getActiveSessions().");
}

if (!service.includes("revokeOtherSessions")) {
  failures.push("sessionManagementService must expose revokeOtherSessions().");
}

if (!settings.includes("Active sessions")) {
  failures.push("Settings > Account should include an Active sessions section.");
}

if (!settings.includes("Revoke other sessions placeholder")) {
  failures.push("Settings > Account should include a safe other-session revocation placeholder.");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Session management smoke passed.");