import { readFileSync } from "node:fs";

const service = readFileSync("src/services/safeModeService.ts", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const main = readFileSync("src/main.tsx", "utf8");
const boundary = readFileSync("src/components/DesktopStartupErrorBoundary.tsx", "utf8");
const settings = readFileSync("src/services/settingsService.ts", "utf8");
const banner = readFileSync("src/components/SafeModeBanner.tsx", "utf8");
const doc = readFileSync("docs/safe-mode.md", "utf8");

const checks = [
  [service.includes("getStartupState"), "safe mode startup state"],
  [service.includes("recordStartupCrash"), "startup crash trigger"],
  [service.includes("clearCache"), "clear cache action"],
  [service.includes("restartNormally"), "restart normally action"],
  [main.includes("if (!safeMode.active)"), "bootstrap optional service guard"],
  [boundary.includes("safeModeService.recordStartupCrash"), "error boundary crash count"],
  [settings.includes("corrupted_local_settings"), "corrupted settings trigger"],
  [app.includes("<SafeModeBanner"), "safe mode banner render"],
  [app.includes("!safeMode.active"), "optional hooks disabled"],
  [banner.includes("Reset settings"), "reset settings action"],
  [banner.includes("Restart normally"), "restart normally action"],
  [doc.includes("realtime is paused"), "docs disabled services"],
  [doc.includes("does not clear auth sessions"), "docs auth safety"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);

if (failed.length) {
  throw new Error(`Safe Mode smoke test failed: ${failed.join(", ")}`);
}

console.log("Safe Mode startup foundation smoke test passed.");
