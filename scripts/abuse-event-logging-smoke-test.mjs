import { readFileSync } from "node:fs";

const service = readFileSync("src/services/abuseEventService.ts", "utf8");
const logging = readFileSync("src/services/loggingService.ts", "utf8");
const adminPanel = readFileSync("src/components/AdminOperationsPanel.tsx", "utf8");
const docs = readFileSync("docs/abuse-event-logging.md", "utf8");

const checks = [
  [service.includes("loggingService.logWarn"), "abuse events route through central logging"],
  [service.includes("redactDiagnosticsValue"), "abuse metadata uses logging redaction"],
  [service.includes("PRIVATE_METADATA_KEY_PATTERN"), "private metadata key filter exists"],
  [service.includes("privateContentStored: false"), "private content is explicitly not stored"],
  [service.includes("formatUserMessage"), "user-friendly error message helper exists"],
  [service.includes("unauthorized_private_channel_access"), "private channel abuse event exists"],
  [service.includes("suspicious_attachment"), "suspicious attachment event exists"],
  [logging.includes("authorization") && logging.includes("cookie") && logging.includes("password"), "central redaction covers sensitive fields"],
  [adminPanel.includes("abuseEventService.getAdminSummary"), "Admin Operations uses abuse summary"],
  [adminPanel.includes("private content is not stored"), "Admin Operations copy avoids sensitive detail"],
  [docs.includes("Do not store") && docs.includes("message content"), "docs ban private content"],
  [docs.includes("Future Supabase implementation"), "docs describe backend path"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) {
  throw new Error(`Abuse event logging smoke test failed: ${failed.join(", ")}`);
}

console.log("Abuse event logging smoke test passed.");
