import { readFileSync } from "node:fs";

const service = readFileSync("src/services/accountDeletionService.ts", "utf8");
const page = readFileSync("src/account/pages/DeletePage.tsx", "utf8");
const confirmPage = readFileSync("src/account/pages/ConfirmAccountDeletionPage.tsx", "utf8");
const requestEdge = readFileSync("supabase/functions/account-deletion/index.ts", "utf8");
const finalizeEdge = readFileSync("supabase/functions/account-deletion-finalize/index.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260906120000_simplified_30_day_deletion.sql", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");
const failures = [];

for (const forbidden of ["localStorage", "signInWithPassword", "confirmationUsername", "current-password"]) {
  if (service.includes(forbidden) || page.includes(forbidden)) failures.push(`legacy account deletion requirement remains: ${forbidden}`);
}
for (const marker of ["begin_current_user_account_deletion", "issue_account_deletion_email_confirmation", "confirm_account_deletion_email_confirmation", "sha256Hex", "generateOpaqueToken"]) {
  if (!requestEdge.includes(marker)) failures.push(`account confirmation edge missing: ${marker}`);
}
for (const marker of ["ACCOUNT_DELETION_FINALIZATION_ENABLED", "ACCOUNT_DELETION_WORKER_SECRET", "finalize_due_account_deletions", "deleteUser"]) {
  if (!finalizeEdge.includes(marker)) failures.push(`account finalizer missing: ${marker}`);
}
for (const marker of ["account_deletion_email_confirmations", "interval '30 days'", "interval '24 hours'", "pending_deletion", "SERVICE_ROLE_REQUIRED", "revoke insert, update, delete on public.account_deletion_requests from authenticated"]) {
  if (!migration.includes(marker)) failures.push(`account lifecycle migration missing: ${marker}`);
}
if (!confirmPage.includes("window.history.replaceState")) failures.push("confirmation token is not removed from browser history");
if (!/\[functions\.account-deletion\]\s*\r?\nverify_jwt\s*=\s*false/.test(config)) failures.push("public one-time confirmation endpoint is not configured");
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Account email-confirmed 30-day deletion contract passed.");
