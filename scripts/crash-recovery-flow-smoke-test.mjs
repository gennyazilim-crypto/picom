import { readFileSync } from "node:fs";

const service = readFileSync("src/services/crashRecoveryService.ts", "utf8");
const dialog = readFileSync("src/components/CrashRecoveryDialog.tsx", "utf8");
const boundary = readFileSync("src/components/DesktopStartupErrorBoundary.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const logging = readFileSync("src/services/loggingService.ts", "utf8");
const styles = readFileSync("src/styles.css", "utf8");

const checks = [
  [service.includes("recordStartupOpened"), "startup recovery detection"],
  [service.includes("recordCleanShutdown"), "clean shutdown marker"],
  [service.includes("recordStartupStable"), "stable startup marker"],
  [service.includes("shouldShowRecoveryDialog"), "one-time recovery prompt guard"],
  [service.includes("dismissRecoveryDialog"), "dismiss recovery prompt"],
  [service.includes("exportDiagnosticsFile"), "diagnostics export action"],
  [service.includes("runtimeState"), "runtime state in diagnostics"],
  [dialog.includes("Continue normally"), "continue normally action"],
  [dialog.includes("Safe Mode"), "safe mode action"],
  [dialog.includes("Export logs"), "export logs action"],
  [dialog.includes("Reset local settings"), "reset settings action"],
  [dialog.includes("Passwords, tokens, cookies, auth headers"), "redaction copy"],
  [boundary.includes("crashRecoveryService.recordCrash"), "error boundary records crash"],
  [boundary.includes("loggingService.captureException"), "central logging capture"],
  [app.includes("<CrashRecoveryDialog"), "app renders recovery dialog"],
  [app.includes("recordStartupOpened"), "app starts recovery tracking"],
  [app.includes("recordCleanShutdown"), "app records clean shutdown"],
  [logging.includes("SENSITIVE_KEY_PATTERN"), "central secret redaction"],
  [logging.includes("authorization"), "auth header redaction"],
  [styles.includes(".crash-recovery-dialog"), "desktop recovery styling"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);

if (failed.length) {
  throw new Error(`Crash recovery flow smoke test failed: ${failed.join(", ")}`);
}

console.log("Crash recovery flow smoke test passed.");
