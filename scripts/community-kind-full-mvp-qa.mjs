import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const suites = [
  ["kind domain", "scripts/community-kind-domain-smoke.mjs"],
  ["legacy Text backfill", "scripts/community-kind-backfill-smoke.mjs"],
  ["typed creation wizard", "scripts/typed-community-creation-wizard-smoke.mjs"],
  ["Text defaults", "scripts/text-community-default-template-smoke.mjs"],
  ["Radio defaults", "scripts/radio-community-default-template-smoke.mjs"],
  ["Podcast defaults", "scripts/podcast-community-default-template-smoke.mjs"],
  ["type-specific routing and restoration", "scripts/type-specific-community-routing-smoke.mjs"],
  ["kind permissions and RLS", "scripts/community-kind-permissions-rls-smoke.mjs"],
  ["typed invites and join landing", "scripts/typed-community-invite-join-smoke.mjs"],
  ["owner admin moderator member visitor access", "scripts/community-role-access-smoke-test.mjs"],
  ["public join and leave", "scripts/public-community-join-production-test.mjs"],
  ["ownership transfer", "scripts/community-ownership-transfer-smoke-test.mjs"],
  ["recoverable archive", "scripts/community-delete-safety-smoke-test.mjs"],
  ["Radio and Podcast community surfaces", "scripts/audio-community-smoke.mjs"],
  ["Supabase schema", "scripts/supabase-schema-smoke-test.mjs"],
  ["Supabase RLS structural/live-ready", "scripts/supabase-rls-smoke.mjs"],
];

const migrationPath = "supabase/migrations/20260711000800_community_lifecycle_management.sql";
const qaDocPath = "docs/community-kind-full-mvp-qa.md";
for (const file of [migrationPath, "supabase/tests/rls/community_lifecycle_management.sql", qaDocPath]) {
  if (!existsSync(file)) throw new Error(`Community kind Full MVP QA is missing ${file}`);
}

const migration = readFileSync(migrationPath, "utf8");
for (const marker of ["transfer_community_ownership", "archive_community", "is_active_community", "ownership_transfer", "community_archive"]) {
  if (!migration.includes(marker)) throw new Error(`Lifecycle migration is missing ${marker}`);
}
if (/delete\s+from\s+public\.communities/i.test(migration)) throw new Error("Community lifecycle must retain community rows for controlled recovery.");

for (const [label, script] of suites) {
  if (!existsSync(script)) throw new Error(`Missing ${label} suite: ${script}`);
  console.log(`\n> ${label}`);
  const result = spawnSync(process.execPath, [script], { stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("\nCommunity kind Full MVP QA contract passed for Text, Radio, and Podcast.");
