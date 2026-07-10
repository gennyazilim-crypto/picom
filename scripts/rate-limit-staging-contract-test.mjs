import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260710125000_user_action_rate_limits.sql", "utf8");
const tests = readFileSync("supabase/tests/rls/user_action_rate_limits.sql", "utf8");
const auth = readFileSync("src/services/authService.ts", "utf8");
const messages = readFileSync("src/services/messageService.ts", "utf8");
const uploads = readFileSync("src/services/uploadService.ts", "utf8");
const livekit = readFileSync("supabase/functions/livekit-token/index.ts", "utf8");
const abuse = readFileSync("src/services/abuseEventService.ts", "utf8");
const invites = readFileSync("src/services/community/communityInviteService.ts", "utf8");
const search = readFileSync("src/services/advancedSearchService.ts", "utf8");
const docs = readFileSync("docs/rate-limit-staging-validation.md", "utf8");
const runner = readFileSync("scripts/hosted-staging-rate-limit-validation.mjs", "utf8");

const checks = [
  [migration.includes("('message_send', 30, 60)") && migration.includes("('attachment_metadata', 20, 300)") && migration.includes("('livekit_token', 10, 60)"), "fixed thresholds"],
  [migration.includes("messages_user_rate_limit") && migration.includes("attachments_user_rate_limit") && tests.includes("authenticated cannot read or mutate limiter counters"), "trigger/counter protection"],
  [auth.includes("AUTH_RATE_LIMITED") && messages.includes('messageError("RATE_LIMITED"') && uploads.includes('uploadError("RATE_LIMITED"'), "user-facing error mapping"],
  [livekit.includes('consume_current_user_action_rate_limit') && livekit.includes('Retry-After') && livekit.includes('RATE_LIMITED'), "Edge Function limiter"],
  [abuse.includes("PRIVATE_METADATA_KEY_PATTERN") && abuse.includes("password|token|secret|authorization|cookie") && abuse.includes("privateContentStored: false"), "abuse log redaction"],
  [!invites.includes("RATE_LIMITED") && !search.includes("RATE_LIMITED") && docs.includes("BLOCKER: invite") && docs.includes("BLOCKER: search"), "documented invite/search gaps"],
  [runner.includes("STAGING_ONLY_FRESH_SYNTHETIC_USERS") && runner.includes("second-user") && runner.includes("typeof payload?.token"), "bounded live runner"],
  [docs.includes("Threshold decision: unchanged") && docs.includes("Storage object bytes"), "no evidence-free tuning and upload gap"],
];
const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) throw new Error(`Rate-limit staging contract failed: ${failed.join(", ")}`);
console.log("Rate-limit thresholds, trigger/Edge enforcement, UI errors, redacted abuse logs, and documented gaps contract passed.");
