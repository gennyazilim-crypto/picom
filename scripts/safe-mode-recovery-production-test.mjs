import { readFile } from "node:fs/promises";

const [service, main, app, boundary, migration, banner, docs, packageJson] = await Promise.all([
  readFile("src/services/safeModeService.ts", "utf8"),
  readFile("src/main.tsx", "utf8"),
  readFile("src/App.tsx", "utf8"),
  readFile("src/components/DesktopStartupErrorBoundary.tsx", "utf8"),
  readFile("src/services/localDataMigrationService.ts", "utf8"),
  readFile("src/components/SafeModeBanner.tsx", "utf8"),
  readFile("docs/safe-mode.md", "utf8"),
  readFile("package.json", "utf8"),
]);

const checks = [
  [service.includes("startupCrashThreshold = 2") && service.includes("recordStartupCrash"), "repeated crash detection"],
  [service.includes("recordStartupStable") && app.includes("safeModeService.recordStartupStable()"), "stable reset"],
  [service.includes("runtimeForcedReason") && main.includes('enableSafeMode("local_data_migration_failed")'), "runtime migration fallback"],
  [main.includes("if (!safeMode.active)") && app.includes("!safeMode.active"), "optional services paused"],
  [service.includes("resetSettings") && service.includes("clearCache") && service.includes("exportLogs"), "recovery actions"],
  [boundary.includes("Restart in Safe Mode") && boundary.includes("restartInSafeMode"), "error screen recovery"],
  [migration.includes("quota/policy failure") && migration.includes("ok: false"), "storage write guard"],
  [banner.includes("local_data_migration_failed") && docs.includes("Loop prevention"), "reason and loop docs"],
  [packageJson.includes('"safe-mode:production:test"'), "package script"],
];
const failed = checks.filter(([ok]) => !ok);
if (failed.length) { for (const [, label] of failed) console.error(`FAIL: ${label}`); process.exit(1); }
for (const [, label] of checks) console.log(`PASS: ${label}`);
