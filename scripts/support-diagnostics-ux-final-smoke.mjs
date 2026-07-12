import fs from "node:fs";

const service = fs.readFileSync("src/services/diagnostics/diagnosticsService.ts", "utf8");
const section = fs.readFileSync("src/components/settings/DiagnosticsSection.tsx", "utf8");
const settings = fs.readFileSync("src/components/SettingsModal.tsx", "utf8");

for (const needle of ["voiceStatus", "voiceDiagnosticsRegistry.getSummary()", "recentErrors", "recentLogs", "loggingService.redactDiagnosticsValue", "commitShort", "releaseChannel"]) {
  if (!service.includes(needle)) throw new Error(`Diagnostics export is missing ${needle}`);
}
for (const needle of ['exportDiagnostics("json"', "Copy diagnostics", "Export diagnostics", "snapshot.serviceStatus.voiceStatus", "snapshot.recentErrors.length"]) {
  if (!section.includes(needle)) throw new Error(`Diagnostics UX is missing ${needle}`);
}
if (!settings.includes("Support diagnostics export") || !settings.includes('setActive("Diagnostics")')) throw new Error("Advanced settings diagnostics entry is missing");
for (const forbidden of ["authorization:", "password:", "accessToken:", "serviceRoleKey:"]) {
  if (service.includes(forbidden)) throw new Error(`Diagnostics service contains forbidden field ${forbidden}`);
}

console.log("Support diagnostics UX final smoke passed.");
