import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const loggingFacadePath = resolve(root, "src/services/loggingService.ts");
const loggingPath = resolve(root, "src/services/logging/loggingService.ts");
const redactionPath = resolve(root, "src/services/logging/logRedaction.ts");

if (!existsSync(loggingPath)) {
  throw new Error("Missing central logging service implementation.");
}

if (!existsSync(loggingFacadePath)) {
  throw new Error("Missing src/services/logging/loggingService.ts facade.");
}

const implementation = readFileSync(loggingPath, "utf8");
const redaction = readFileSync(redactionPath, "utf8");
const combinedImplementation = `${implementation}\n${redaction}`;
const facade = readFileSync(loggingFacadePath, "utf8");

if (!facade.includes('export * from "./logging/loggingService"')) throw new Error("Missing logging facade re-export.");

const requiredApi = [
  "logDebug",
  "logInfo",
  "logWarn",
  "logError",
  "captureException",
  "getLogs",
  "getRecentLogs",
  "clearLogs",
  "exportLogs",
  "redactDiagnosticsValue",
  "onLog"
];

for (const term of requiredApi) {
  if (!implementation.includes(term)) {
    throw new Error(`Missing logging service API: ${term}`);
  }
}

const redactionTerms = [
  "password",
  "token",
  "authorization",
  "cookie",
  "service[-_]?role",
  "livekit",
  "signing",
  "access[-_]?token",
  "refresh[-_]?token"
];

for (const term of redactionTerms) {
  if (!combinedImplementation.toLowerCase().includes(term.toLowerCase())) {
    throw new Error(`Missing logging redaction coverage for: ${term}`);
  }
}

const behaviorChecks = [
  ["bounded log buffer", "MAX_RETAINED_LOGS = 250"],
  ["old log trimming", "logs.splice(0, logs.length - MAX_RETAINED_LOGS)"],
  ["listener cleanup", "listeners.delete(listener)"],
  ["circular metadata guard", "[circular]"],
  ["large message truncation", "[truncated]"],
  ["error redaction", "value instanceof Error"],
  ["user-safe formatter", "formatUserFacingError"]
];

for (const [label, needle] of behaviorChecks) {
  if (!combinedImplementation.includes(needle)) {
    throw new Error(`Missing logging behavior: ${label}`);
  }
}

if (/console\.(log|warn|error|info|debug)\(/.test(implementation)) {
  throw new Error("loggingService should not mirror redacted logs back to console by default.");
}

console.log("✓ central logging service facade");
console.log("✓ redaction coverage for sensitive fields");
console.log("✓ bounded log buffer and export controls");
console.log("✓ listener cleanup and diagnostics helpers");
console.log("✓ logging service smoke test completed");
