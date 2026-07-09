import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
if (process.argv.includes("--execute") || process.argv.includes("--apply")) {
  throw new Error("This production-safe preflight never executes remote SQL or migrations.");
}

const requiredFiles = [
  "supabase/migrations/20260704001800_channels_rls.sql",
  "supabase/migrations/20260704001900_messages_rls.sql",
  "supabase/migrations/20260704002000_attachments_rls.sql",
  "supabase/migrations/20260704002100_reactions_rls.sql",
  "supabase/migrations/20260704002300_storage_message_attachments_policies.sql",
  "supabase/migrations/20260704002600_community_public_access_rls.sql",
  "supabase/tests/rls/community_access_boundaries.sql",
  "supabase/tests/rls/message_ownership_and_storage.sql",
  "docs/production-migration-runbook.md",
  "docs/production-rls-verification.md"
];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) throw new Error(`Missing production RLS evidence: ${file}`);
}

const accessTests = readFileSync(resolve(root, "supabase/tests/rls/community_access_boundaries.sql"), "utf8");
const ownershipTests = readFileSync(resolve(root, "supabase/tests/rls/message_ownership_and_storage.sql"), "utf8");
const verificationDoc = readFileSync(resolve(root, "docs/production-rls-verification.md"), "utf8");
const requiredEvidence = [
  [accessTests, "anonymous cannot read private channel"],
  [accessTests, "visitor can read public non-private channel"],
  [accessTests, "visitor cannot send messages without membership"],
  [accessTests, "member can send in allowed text channel"],
  [accessTests, "admin-level member can read private channel"],
  [accessTests, "owner can manage channels"],
  [accessTests, "visitor cannot read attachment metadata for private message"],
  [ownershipTests, "author can edit own message"],
  [ownershipTests, "other member cannot edit another user message"],
  [verificationDoc, "Mention Feed"]
];

for (const [source, text] of requiredEvidence) {
  if (!source.includes(text)) throw new Error(`Missing production RLS scenario evidence: ${text}`);
}

const locator = process.platform === "win32" ? "where.exe" : "which";
const cli = spawnSync(locator, ["supabase"], { encoding: "utf8" });
if (cli.status === 0) {
  console.log(`OK Supabase CLI available at: ${cli.stdout.trim().split(/\r?\n/)[0]}`);
} else {
  console.warn("WARN Supabase CLI unavailable; install it before real local/staging pgTAP execution.");
}

console.log("OK required migration, policy, and pgTAP evidence files exist");
console.log("OK anonymous, visitor, member, admin, owner, attachment, ownership, and Mention Feed scenarios are documented");
console.log("INFO local destructive-safe tests: npm run supabase:rls:test");
console.log("INFO this command performed no database connection, migration, or remote mutation");
