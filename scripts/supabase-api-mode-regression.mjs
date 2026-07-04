import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();

function read(relativePath) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }

  return readFileSync(absolutePath, "utf8");
}

function assertContains(relativePath, needle, label) {
  const contents = read(relativePath);
  if (!contents.includes(needle)) {
    throw new Error(`${label} not found in ${relativePath}`);
  }

  console.log(`✓ ${label}`);
}

function assertFile(relativePath, label) {
  if (!existsSync(join(root, relativePath))) {
    throw new Error(`${label} missing: ${relativePath}`);
  }

  console.log(`✓ ${label}`);
}

try {
  assertFile("supabase/config.toml", "Supabase config");
  assertFile("src/services/supabase/database.types.ts", "Supabase database types");
  assertContains("src/services/dataSourceService.ts", "supabase", "data source Supabase mode");
  assertContains("src/services/authService.ts", "signInWithPassword", "Supabase auth sign-in path");
  assertContains("src/services/communityService.ts", ".from(\"communities\")", "communities API path");
  assertContains("src/services/channelService.ts", ".from(\"channels\")", "channels API path");
  assertContains("src/services/messageService.ts", "listMessages", "messages list service path");
  assertContains("src/services/messageSendMutation.ts", ".from(\"messages\")", "messages send mutation path");
  assertContains("src/services/membersService.ts", ".from(\"community_members\")", "members API path");
  assertContains("src/services/reactionService.ts", ".from(\"message_reactions\")", "reactions API path");
  assertContains("src/App.tsx", "communityService.listCommunities", "ServerRail Supabase data load");
  assertContains("src/App.tsx", "channelCategoryService.listCategories", "CommunitySidebar Supabase category load");
  assertContains("src/App.tsx", "messageService.listMessages", "MessageList Supabase data load");
  assertContains("src/App.tsx", "membersService.listMembers", "MemberSidebar Supabase data load");
  assertFile("supabase/migrations/20260704001600_communities_rls.sql", "communities RLS migration");
  assertFile("supabase/migrations/20260704001800_channels_rls.sql", "channels RLS migration");
  assertFile("supabase/migrations/20260704001900_messages_rls.sql", "messages RLS migration");
  assertFile("supabase/migrations/20260704002100_reactions_rls.sql", "reactions RLS migration");
  console.log("✓ Supabase API mode regression test completed");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
