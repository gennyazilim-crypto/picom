import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const crashSource = readFileSync(resolve(root, "src/services/crashRecoveryService.ts"), "utf8");
const boundarySource = readFileSync(resolve(root, "src/components/DesktopStartupErrorBoundary.tsx"), "utf8");

const requiredCrashTerms = [
  "diagnosticsService",
  "getSnapshot",
  "recentLogs",
  "formatUserError",
  "recordCrash"
];

for (const term of requiredCrashTerms) {
  if (!crashSource.includes(term)) {
    throw new Error(`Missing crash diagnostics wiring: ${term}`);
  }
}

const requiredBoundaryTerms = [
  "loggingService.captureException",
  "crashRecoveryService.recordCrash",
  "crashRecoveryService.getDiagnosticsText",
  "clipboardService.copyText"
];

for (const term of requiredBoundaryTerms) {
  if (!boundarySource.includes(term)) {
    throw new Error(`Missing ErrorBoundary crash wiring: ${term}`);
  }
}

console.log("✓ crash diagnostics service wiring");
console.log("✓ startup error boundary diagnostics wiring");
console.log("✓ crash smoke test completed");
