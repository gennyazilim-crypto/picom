import { readFileSync } from "node:fs";

const service = readFileSync("src/services/multiClientSessionSyncService.ts", "utf8");
const hook = readFileSync("src/hooks/useProtectedDesktopSession.ts", "utf8");
const docs = readFileSync("docs/multi-client-session-sync.md", "utf8");

const forbidden = [/access_token/i, /refresh_token/i, /authorization/i, /console\.(log|warn|error|info)/];
const corpus = `${service}\n${hook}`;
const forbiddenHits = forbidden.filter((pattern) => pattern.test(corpus));

const checks = [
  [forbiddenHits.length === 0, `forbidden secret/log patterns: ${forbiddenHits.join(", ")}`],
  [service.includes("user:profile_updated"), "profile sync event"],
  [service.includes("user:settings_updated"), "settings sync event"],
  [service.includes("user:session_revoked"), "session revoked event"],
  [service.includes("user:permissions_updated"), "permissions sync event"],
  [service.includes("user:membership_updated"), "membership sync event"],
  [service.includes("loggingService.logInfo") && hook.includes("loggingService.logWarn"), "central logging only"],
  [service.includes("getSupabaseChannelName"), "Supabase channel placeholder"],
  [hook.includes("multiClientSessionSyncService.subscribe"), "hook subscribes to sync service"],
  [hook.includes("authService.signOut().finally"), "revoked session signs out safely"],
  [hook.includes("Current desktop session revoked by multi-client sync"), "redacted revoked-session diagnostic"],
  [docs.includes("Auth middleware must reject expired or revoked sessions"), "docs backend auth requirement"],
  [docs.includes("never access tokens or refresh tokens"), "docs token safety"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) {
  throw new Error(`Multi-client session sync smoke test failed: ${failed.join(", ")}`);
}

console.log("Multi-client session sync smoke test passed.");
