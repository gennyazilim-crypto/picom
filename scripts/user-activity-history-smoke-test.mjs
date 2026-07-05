import { readFileSync } from "node:fs";

const service = readFileSync("src/services/accountActivityService.ts", "utf8");
const hook = readFileSync("src/hooks/useProtectedDesktopSession.ts", "utf8");
const settings = readFileSync("src/components/SettingsModal.tsx", "utf8");
const docs = readFileSync("docs/user-activity-history.md", "utf8");

const forbidden = [/access_token/i, /refresh_token/i, /authorization/i, /cookie/i, /console\.(log|warn|error|info)/];
const corpus = `${service}\n${hook}`;
const forbiddenHits = forbidden.filter((pattern) => pattern.test(corpus));

const checks = [
  [forbiddenHits.length === 0, `forbidden secret/log patterns: ${forbiddenHits.join(", ")}`],
  [service.includes("login_success"), "login success activity type"],
  [service.includes("logout"), "logout activity type"],
  [service.includes("session_revoked"), "session revoked activity type"],
  [service.includes("ipAddressStored: false"), "raw IP not stored"],
  [service.includes("loggingService.redactDiagnosticsValue"), "metadata redaction"],
  [hook.includes("accountActivityService.recordActivity"), "auth hook records activity"],
  [settings.includes("Account Activity"), "settings account activity UI"],
  [settings.includes("Account activity history"), "settings activity list"],
  [docs.includes("GET /account/activity"), "future route documented"],
  [docs.includes("User can only see their own activity"), "ownership boundary documented"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) {
  throw new Error(`User activity history smoke test failed: ${failed.join(", ")}`);
}

console.log("User activity history smoke test passed.");
