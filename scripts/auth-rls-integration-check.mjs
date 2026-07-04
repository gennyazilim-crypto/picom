import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "src/services/supabase/supabaseClient.ts",
  "src/services/authService.ts",
  "src/hooks/useProtectedDesktopSession.ts",
  "supabase/migrations/20260704001300_auth_profile_trigger.sql",
  "supabase/migrations/20260704001500_profiles_rls.sql",
  "supabase/migrations/20260704001600_communities_rls.sql",
  "supabase/migrations/20260704001700_community_members_rls.sql",
  "supabase/migrations/20260704001800_channels_rls.sql",
  "supabase/migrations/20260704001900_messages_rls.sql",
  "supabase/migrations/20260704002000_attachments_rls.sql",
  "supabase/migrations/20260704002100_reactions_rls.sql",
  "docs/rls-policies.md",
  "docs/rls-security-checklist.md",
  "docs/member-only-community-access-test.md",
  "docs/private-channel-access-boundaries-test.md"
];

const forbiddenSnippets = [
  "service_role",
  "SUPABASE_SERVICE_ROLE",
  "Authorization: Bearer",
  "console.log(password",
  "console.warn(password",
  "console.error(password",
  "console.log(token",
  "console.warn(token",
  "console.error(token",
  "console.log(session",
  "console.warn(session",
  "console.error(session"
];

function pass(message) {
  console.log(`✓ ${message}`);
}

function fail(message) {
  console.error(`Auth/RLS integration check failed: ${message}`);
  process.exit(1);
}

for (const file of requiredFiles) {
  const path = join(root, file);
  if (!existsSync(path)) {
    fail(`missing required integration file: ${file}`);
  }
  pass(`found ${file}`);
}

const filesToScan = [
  "src/services/supabase/supabaseClient.ts",
  "src/services/authService.ts",
  "src/hooks/useProtectedDesktopSession.ts",
  "docs/rls-policies.md",
  "docs/rls-security-checklist.md"
];

for (const file of filesToScan) {
  const content = readFileSync(join(root, file), "utf8");
  for (const snippet of forbiddenSnippets) {
    if (content.includes(snippet)) {
      fail(`${file} contains forbidden sensitive snippet: ${snippet}`);
    }
  }
  pass(`sensitive snippet scan passed for ${file}`);
}

pass("Auth/RLS integration check completed");