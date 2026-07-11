import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const shouldRunRealTests = process.argv.includes("--run");
const rlsDir = join(root, "supabase", "tests", "rls");
const sourceDir = join(root, "src");

const requiredFiles = [
  "community_access_boundaries.sql",
  "message_ownership_and_storage.sql",
  "direct_messages.sql",
  "verification_security.sql",
  "community_lifecycle_management.sql",
  "podcast_full_mvp.sql",
  "profile_access_cross_community_privacy.sql",
  "text_community_messaging_integration.sql",
  "audio_production_integration.sql",
  "friends_dm_production_integration.sql",
  "feed_mentions_production_integration.sql",
];

const requiredScenarioSnippets = [
  "anonymous can read public community metadata",
  "visitor cannot send messages without membership",
  "member can send in allowed text channel",
  "member cannot manage channels",
  "admin-level member can read private channel",
  "owner can manage channels",
  "author can edit own message",
  "other member cannot edit another user message",
  "owner can delete visible community message",
  "non-member cannot read direct messages",
  "non-member cannot read direct conversation metadata",
  "non-member cannot read direct participants",
  "non-member cannot read direct attachments",
  "non-member cannot read direct reactions",
  "blocked participant cannot send direct messages",
  "user cannot self-approve verification",
  "approved verification is readable",
  "non-reviewer cannot review verification",
  "non-owner cannot transfer ownership",
  "ownership target must be a current member",
  "archived community is hidden from normal authenticated reads",
  "archive retains child data for controlled recovery",
  "draft podcast episodes remain private",
  "playback progress belongs only to current user",
  "podcast storage enforces episode ownership",
  "visitor can read everyone-profile basics",
  "visitor cannot read profile activity without trusted relationship",
  "shared member sees only public mutual-community activity",
  "friend still cannot read private-community source activity",
  "blocked user cannot view profile basics",
  "removing community access removes profile activity visibility",
  "friends-only profile is hidden from visitor",
  "idempotent retry returns the previous successful message",
  "idempotency key cannot be reused for different message content",
  "member cannot send Text messages to a Radio community",
  "private channel denial is enforced by the message RPC",
  "pending attachment is linked atomically to the sent message",
  "Radio and Podcast tables preserve type-specific community guards",
  "Podcast drafts and private media remain RLS-protected",
  "Radio and Podcast Realtime publications cover production tables",
  "idempotency key rejects a different Direct Message payload",
  "DM message and attachment metadata commit through one RPC",
  "DM pending uploads require an authorized participant",
  "Friends and Direct Messages Realtime publications cover production tables",
  "Feed RPC reserves one look-ahead row for exact keyset pagination",
  "Feed state changes are published for realtime reconciliation",
  "Feed visibility remains source-authorized by RLS",
];

function fail(message) {
  console.error(`Supabase RLS smoke failed: ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`OK ${message}`);
}

function warn(message) {
  console.warn(`WARN ${message}`);
}

function readAllFiles(dir, acc = []) {
  if (!existsSync(dir)) {
    return acc;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      readAllFiles(fullPath, acc);
    } else {
      acc.push(fullPath);
    }
  }

  return acc;
}

if (!existsSync(rlsDir)) {
  fail("missing supabase/tests/rls directory");
}

const sqlFiles = requiredFiles.map((file) => join(rlsDir, file));
for (const filePath of sqlFiles) {
  if (!existsSync(filePath)) {
    fail(`missing ${relative(root, filePath)}`);
  }
  pass(`found ${relative(root, filePath)}`);
}

const combinedSql = sqlFiles.map((filePath) => readFileSync(filePath, "utf8")).join("\n");
for (const snippet of requiredScenarioSnippets) {
  if (!combinedSql.includes(snippet)) {
    fail(`missing RLS test scenario snippet: ${snippet}`);
  }
  pass(`covers scenario: ${snippet}`);
}

for (const filePath of sqlFiles) {
  const sql = readFileSync(filePath, "utf8");
  if (!/select\s+plan\(/i.test(sql) || !/select\s+\*\s+from\s+finish\(\)/i.test(sql)) {
    fail(`${relative(root, filePath)} is not shaped like a pgTAP test`);
  }
  if (!/rollback\s*;/i.test(sql)) {
    fail(`${relative(root, filePath)} must rollback fixture data`);
  }
}
pass("RLS SQL files are pgTAP-shaped and rollback fixtures");

const rendererFiles = readAllFiles(sourceDir).filter((filePath) => /\.(ts|tsx|js|jsx)$/.test(filePath));
const forbiddenSecretPattern = /SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_SERVICE_ROLE|service_role_key|service-role-key|serviceRoleKey/i;
for (const filePath of rendererFiles) {
  const content = readFileSync(filePath, "utf8");
  if (forbiddenSecretPattern.test(content)) {
    fail(`possible service-role exposure in ${relative(root, filePath)}`);
  }
}
pass("no Supabase service-role key references found in renderer source");

const appSource = readFileSync(join(sourceDir, "App.tsx"), "utf8");
const mockProfilesSource = readFileSync(join(sourceDir, "data", "mockProfiles.ts"), "utf8");
if (!appSource.includes("visibleMentionItems") || !appSource.includes("canViewChannel(access, channel)")) {
  fail("Mention Feed must filter inaccessible channel mentions in mock/client UX");
}
pass("Mention Feed filters inaccessible channel mentions");
if (!mockProfilesSource.includes("filterCommunitiesForViewer") || !mockProfilesSource.includes("canViewChannel(access, channel)")) {
  fail("Profile activity/media must filter inaccessible community channels in mock/client UX");
}
pass("Profile activity and media filter inaccessible channels");

const hardeningMigration = join(root, "supabase", "migrations", "20260710004800_mvp_plus_security_hardening.sql");
if (!existsSync(hardeningMigration)) {
  fail("missing MVP+ RLS hardening migration");
}
pass("MVP+ RLS hardening migration exists");

const cli = spawnSync("supabase", ["--version"], { encoding: "utf8" });
if (cli.status !== 0) {
  if (shouldRunRealTests) {
    fail([
      "Supabase CLI is unavailable, so real RLS tests were not run.",
      "Install it, start local Supabase, then run:",
      "  npm run supabase:rls:test"
    ].join("\n"));
  }

  warn("Supabase CLI unavailable. Structural RLS smoke passed, but real pgTAP execution was skipped.");
  warn("Run `npm run supabase:rls:test` after installing Supabase CLI.");
  process.exit(0);
}

pass(`Supabase CLI available: ${cli.stdout.trim()}`);

if (!shouldRunRealTests) {
  warn("Real RLS pgTAP execution skipped by default. Run `npm run supabase:rls:test` to execute it.");
  process.exit(0);
}

for (const file of requiredFiles) {
  const relativeFile = `supabase/tests/rls/${file}`;
  console.log(`\n> supabase test db --file ${relativeFile}`);
  const test = spawnSync("supabase", ["test", "db", "--file", relativeFile], {
    stdio: "inherit",
    shell: false
  });

  if (test.error) {
    throw test.error;
  }

  if (test.status !== 0) {
    fail(`real RLS test failed: ${relativeFile}`);
  }
}

pass("real Supabase RLS tests completed");
