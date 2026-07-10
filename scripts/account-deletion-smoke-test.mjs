import { readFileSync } from "node:fs";

const service = readFileSync("src/services/accountDeletionService.ts", "utf8");
const settings = readFileSync("src/components/SettingsModal.tsx", "utf8");
const requestEdge = readFileSync("supabase/functions/account-deletion/index.ts", "utf8");
const finalizeEdge = readFileSync("supabase/functions/account-deletion-finalize/index.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260710089100_account_deletion_anonymization.sql", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");
const failures = [];

for (const pattern of [/hardDelete/i, /deleteUser\(/i, /removeUser/i, /console\.(log|warn|error|info)/]) if (pattern.test(service)) failures.push(`unsafe renderer pattern: ${pattern}`);
for (const expected of ["requestDeletion", "cancelDeletion", "ownedCommunityCount", "confirmationText", "anonymizeAfter", "sessionsRevoked"]) if (!service.includes(expected)) failures.push(`renderer service missing ${expected}`);
for (const expected of ["requireSupabaseUser", "request_current_user_account_deletion", "cancel_current_user_account_deletion", "scope=global"]) if (!requestEdge.includes(expected)) failures.push(`request edge missing ${expected}`);
for (const expected of ["ACCOUNT_DELETION_FINALIZATION_ENABLED", "ACCOUNT_DELETION_WORKER_SECRET", "safeEqual", "prepare_account_deletion_anonymization", "deleteUser(preparedRow.target_user_id, true)"]) if (!finalizeEdge.includes(expected)) failures.push(`finalize edge missing ${expected}`);
for (const expected of ["DELETION_GRACE_PERIOD_ACTIVE", "SESSION_REVOCATION_REQUIRED", "OWNERSHIP_TRANSFER_REQUIRED", "Deleted User", "revoke all on function", "service_role", "account_profile_anonymized"]) if (!migration.includes(expected)) failures.push(`migration missing ${expected}`);
if (migration.includes("delete from public.messages") || migration.includes("delete from public.account_security_events")) failures.push("message/audit integrity deletion detected");
if (!config.includes("[functions.account-deletion-finalize]") || !config.includes("verify_jwt = false")) failures.push("internal worker config missing");
if (!settings.includes("Danger Zone") || !settings.includes("Request deletion and sign out")) failures.push("Settings confirmation controls missing");
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log("Account deletion production smoke passed.");
