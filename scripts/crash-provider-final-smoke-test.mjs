import { readFile } from "node:fs/promises";

const [service, settings, plan, providerDoc, packageText] = await Promise.all([
  readFile("src/services/diagnostics/crashReporterService.ts", "utf8"),
  readFile("src/components/SettingsModal.tsx", "utf8"),
  readFile("docs/diagnostics/crash-provider-enablement-final.md", "utf8"),
  readFile("docs/diagnostics/crash-reporting-provider.md", "utf8"),
  readFile("package.json", "utf8"),
]);
const checks = [
  [service.includes("CrashReporterProvider") && service.includes("configureProvider") && service.includes("redactDiagnosticsValue"), "provider abstraction and redaction"],
  [service.includes('getItem(ENABLED_KEY) === "true"') && settings.includes("Enable diagnostic reports") && settings.includes("Off by default"), "explicit opt-in"],
  [service.includes("MAX_LOCAL_RECORDS = 50") && service.includes("removeItem(RECORDS_KEY)"), "bounded queue and opt-out deletion"],
  [plan.includes("not approved and disabled") && plan.includes("no raw user/community/channel/message/device identifiers"), "disabled privacy boundary"],
  [plan.toLowerCase().includes("must not be included in asar") && plan.includes("ephemeral CI credential") && plan.includes("always()` cleanup"), "source-map privacy"],
  [plan.includes("provider timeout/429/5xx") && plan.includes("opt out") && plan.includes("Blockers"), "failure and enablement proof"],
  [providerDoc.includes("crash-provider-enablement-final.md") && packageText.includes('"crash:provider:final:smoke"'), "policy integration"],
];
const failed = checks.filter(([ok]) => !ok);
if (failed.length) { for (const [, label] of failed) console.error(`FAIL: ${label}`); process.exit(1); }
for (const [, label] of checks) console.log(`PASS: ${label}`);
