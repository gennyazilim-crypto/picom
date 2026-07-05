import { readFileSync } from "node:fs";

const service = readFileSync("src/services/dataExportService.ts", "utf8");
const settings = readFileSync("src/components/SettingsModal.tsx", "utf8");

const failures = [];

for (const pattern of [/passwordHash/i, /access_token/i, /refresh_token/i, /authorizationHeader/i, /Authorization:/, /service_role/i, /console\.(log|warn|error|info)/]) {
  if (pattern.test(service)) {
    failures.push(`dataExportService includes an unsafe export or logging pattern: ${pattern}`);
  }
}

if (!service.includes("requestExportPlaceholder")) {
  failures.push("dataExportService should expose requestExportPlaceholder().");
}

if (!service.includes("downloadPlaceholderJson")) {
  failures.push("dataExportService should expose downloadPlaceholderJson().");
}

if (!settings.includes("Data export")) {
  failures.push("Settings > Account should include Data export section.");
}

if (!settings.includes("Download export JSON placeholder")) {
  failures.push("Settings > Account should include the export download placeholder button.");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Data export placeholder smoke passed.");