import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "src/services/errorCodes.ts"), "utf8");
const loggingSource = readFileSync(resolve(root, "src/services/loggingService.ts"), "utf8");
const boundarySource = readFileSync(resolve(root, "src/components/DesktopStartupErrorBoundary.tsx"), "utf8");

const requiredCodes = [
  "AUTH_INVALID_CREDENTIALS",
  "AUTH_SESSION_EXPIRED",
  "AUTH_FORBIDDEN",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "PERMISSION_DENIED",
  "COMMUNITY_NOT_FOUND",
  "CHANNEL_NOT_FOUND",
  "MESSAGE_NOT_FOUND",
  "INVITE_INVALID",
  "INVITE_EXPIRED",
  "NETWORK_ERROR",
  "SUPABASE_UNAVAILABLE",
  "REALTIME_UNAVAILABLE",
  "UPLOAD_TOO_LARGE",
  "UPLOAD_INVALID_TYPE",
  "SERVER_ERROR",
  "UNKNOWN_ERROR"
];

for (const code of requiredCodes) {
  if (!source.includes(code)) {
    throw new Error(`Missing app error code: ${code}`);
  }
}

if (!loggingSource.includes("formatUserFacingError")) {
  throw new Error("loggingService.formatUserError is not using the unified formatter.");
}

const uxChecks = [
  ["central capture API", "captureUserError"],
  ["safe app error mapping", "createSafeAppError"],
  ["redacted UX diagnostics", "redactDiagnosticsValue"]
];

for (const [label, needle] of uxChecks) {
  if (!loggingSource.includes(needle)) {
    throw new Error(`Missing unified error UX behavior: ${label}`);
  }
}

const boundaryChecks = [
  ["startup friendly error", "Picom could not finish starting"],
  ["developer diagnostics separation", "Developer diagnostics"],
  ["redacted developer diagnostics", "redactDiagnosticsValue"]
];

for (const [label, needle] of boundaryChecks) {
  if (!boundarySource.includes(needle)) {
    throw new Error(`Missing startup error UX behavior: ${label}`);
  }
}

console.log("✓ unified error code taxonomy");
console.log("✓ user-facing error formatter wiring");
console.log("✓ unified error UX diagnostics separation");
console.log("✓ error smoke test completed");
