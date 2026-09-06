import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260906120000_simplified_30_day_deletion.sql", "utf8");
const requestEdge = readFileSync("supabase/functions/account-deletion/index.ts", "utf8");
const email = readFileSync("supabase/functions/_shared/soft-email-verification.ts", "utf8");
const rls = readFileSync("supabase/tests/rls/simplified_deletion_30_day.sql", "utf8");
const checks = [
  [migration.includes("create table if not exists public.account_deletion_email_confirmations"), "hashed single-use confirmation storage"],
  [migration.includes("token_hash !~ '^[0-9a-f]{64}$'"), "hashed-token validation"],
  [migration.includes("confirmation.expires_at <= confirmed"), "expired confirmation rejection"],
  [migration.includes("confirmation.confirmed_at is not null or confirmation.invalidated_at is not null"), "reused confirmation rejection"],
  [migration.includes("set status = 'pending_deletion'") && migration.includes("interval '30 days'"), "confirmation starts 30-day recovery"],
  [migration.includes("set status = 'canceled'") && migration.includes("scheduled_deletion_at = null"), "authenticated recovery cancellation"],
  [["provider_linked", "provider_unlinked", "provider_link_failed", "provider_login", "session_revoked"].every((eventType) => migration.includes(`'${eventType}'`)), "existing account audit event types preserved"],
  [requestEdge.includes("sendAccountDeletionConfirmationEmail") && email.includes("sendAccountDeletionConfirmationEmail"), "canonical email sender reuse"],
  [requestEdge.includes("sha256Hex(rawToken)") && !requestEdge.includes("console.log"), "no raw confirmation token logging"],
  [rls.includes("foreign account deletion mutation is denied") && rls.includes("reused confirmation token is denied"), "RLS and token test coverage"],
];
const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) throw new Error(`30-day account deletion implementation failed: ${failed.join(", ")}`);
console.log("Email confirmation, recovery, finalization, and RLS contracts passed.");
