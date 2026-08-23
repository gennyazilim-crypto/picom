import { readFileSync } from "node:fs";

const service = readFileSync("src/services/sessionManagementService.ts", "utf8");
const settings = readFileSync("src/components/SettingsModal.tsx", "utf8");
const accountSummary = readFileSync("src/components/settings/AccountSummarySection.tsx", "utf8");
const settingsI18n = readFileSync("src/services/settings/settingsI18n.ts", "utf8");
const accountCenter = readFileSync("src/config/accountCenterUrls.ts", "utf8");

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

if (!settings.includes("revokeOtherSessions") || !settings.includes("getActiveSessions")) {
  failures.push("Settings must keep sessionManagementService getActiveSessions/revokeOtherSessions wiring.");
}

if (!settingsI18n.includes('"account.sessions": "Active sessions"')) {
  failures.push("Settings i18n must keep the Active sessions account label.");
}

if (!accountSummary.includes("accountCenterUrls.sessions") || !accountSummary.includes('t("account.sessions")')) {
  failures.push("Settings > Account must route Active sessions to Account Center.");
}

if (!accountCenter.includes('sessions: withSource("/account/sessions")')) {
  failures.push("Account Center must expose a dedicated sessions URL.");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Session management smoke passed.");
