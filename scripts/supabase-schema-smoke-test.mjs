import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const shouldReset = process.argv.includes("--reset");

const requiredFiles = [
  "supabase/config.toml",
  "supabase/seed.sql",
  "src/services/supabase/database.types.ts",
  "docs/supabase-database.md",
];

const requiredMigrationPrefixes = [
  "20260704000100_baseline",
  "20260704000200_profiles_schema",
  "20260704000300_communities_schema",
  "20260704000400_community_members_schema",
  "20260704000500_roles_schema",
  "20260704000600_channel_categories_schema",
  "20260704000700_channels_schema",
  "20260704000800_messages_schema",
  "20260704000900_message_attachments_schema",
  "20260704001000_message_reactions_schema",
  "20260704001100_read_states_schema",
  "20260704001200_chat_query_indexes",
  "20260704001300_auth_profile_trigger",
  "20260704001400_profile_signup_backfill",
  "20260704001500_profiles_rls",
  "20260704001600_communities_rls",
  "20260704001700_community_members_rls",
  "20260704001800_channels_rls",
  "20260704001900_messages_rls",
  "20260704002000_attachments_rls",
  "20260704002100_reactions_rls",
  "20260704002200_storage_message_attachments_bucket",
  "20260704002300_storage_message_attachments_policies",
  "20260710002900_direct_messages_schema_rls",
  "20260710003000_direct_messages_realtime",
  "20260710003100_social_relationships",
  "20260710003200_user_blocking_privacy",
  "20260710003300_saved_messages",
  "20260710003400_community_events",
];

function fail(message) {
  console.error(`Supabase schema smoke test failed: ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`✓ ${message}`);
}

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    fail(`missing required file: ${file}`);
  }
  pass(`found ${file}`);
}

const migrationsDir = join(root, "supabase", "migrations");
if (!existsSync(migrationsDir)) {
  fail("missing supabase/migrations directory");
}

const migrations = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql"));
for (const prefix of requiredMigrationPrefixes) {
  if (!migrations.some((file) => file.startsWith(prefix))) {
    fail(`missing migration prefix: ${prefix}`);
  }
  pass(`found migration ${prefix}`);
}

const seedSql = readFileSync(join(root, "supabase", "seed.sql"), "utf8");
for (const expected of ["public.profiles", "public.communities", "public.channels", "public.messages"]) {
  if (!seedSql.includes(expected)) {
    fail(`seed file does not reference ${expected}`);
  }
  pass(`seed references ${expected}`);
}

const cliVersion = spawnSync("supabase", ["--version"], { encoding: "utf8" });
if (cliVersion.status === 0) {
  pass(`Supabase CLI available: ${cliVersion.stdout.trim()}`);
} else {
  console.warn("! Supabase CLI not found. Install it before running the optional --reset smoke test.");
}

if (shouldReset) {
  if (cliVersion.status !== 0) {
    fail("cannot run --reset because Supabase CLI is unavailable");
  }

  console.log("Running supabase db reset. This is intended for local development databases only.");
  const reset = spawnSync("supabase", ["db", "reset"], { stdio: "inherit" });
  if (reset.status !== 0) {
    fail("supabase db reset failed");
  }
  pass("supabase db reset completed");
}

pass("Supabase schema smoke test completed");
