import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const loggingSource = readFileSync(resolve(root, "src/services/logging/loggingService.ts"), "utf8");
const diagnosticsSource = readFileSync(resolve(root, "src/services/diagnostics/diagnosticsService.ts"), "utf8");
const feedbackSource = readFileSync(resolve(root, "src/services/feedbackService.ts"), "utf8");

const requiredRedactionTerms = [
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

for (const term of requiredRedactionTerms) {
  if (!loggingSource.toLowerCase().includes(term.toLowerCase())) {
    throw new Error(`Missing diagnostics redaction term: ${term}`);
  }
}

const requiredDiagnosticsFields = [
  "version",
  "platform",
  "releaseChannel",
  "dataSource",
  "realtimeStatus",
  "lastApiError",
  "redactDiagnosticsValue"
];

for (const field of requiredDiagnosticsFields) {
  const found = diagnosticsSource.includes(field) || feedbackSource.includes(field);
  if (!found) {
    throw new Error(`Missing diagnostics field: ${field}`);
  }
}

console.log("✓ diagnostics redaction terms");
console.log("✓ diagnostics payload fields");
console.log("✓ diagnostics smoke test completed");
