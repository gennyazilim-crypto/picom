import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "src/services/errorCodes.ts"), "utf8");
const loggingSource = readFileSync(resolve(root, "src/services/loggingService.ts"), "utf8");

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

console.log("✓ unified error code taxonomy");
console.log("✓ user-facing error formatter wiring");
console.log("✓ error smoke test completed");
