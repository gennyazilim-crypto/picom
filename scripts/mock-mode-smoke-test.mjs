import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();

function readProjectFile(relativePath) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }

  return readFileSync(absolutePath, "utf8");
}

function assertContains(relativePath, needle, label) {
  const contents = readProjectFile(relativePath);
  if (!contents.includes(needle)) {
    throw new Error(`${label} not found in ${relativePath}`);
  }

  console.log(`✓ ${label}`);
}

try {
  assertContains("src/data/mockCommunities.ts", "export const mockCommunities", "mock communities data");
  assertContains("src/services/authService.ts", "getMockSession", "mock auth session path");
  assertContains("src/services/communityService.ts", "dataSource.isMock", "mock community service path");
  assertContains("src/services/channelService.ts", "dataSource.isMock", "mock channel service path");
  assertContains("src/services/messageService.ts", "dataSource.isMock", "mock message service path");
  assertContains("src/services/membersService.ts", "dataSource.isMock", "mock members service path");
  assertContains("src/services/reactionService.ts", "dataSource.isMock", "mock reactions service path");
  assertContains("src/App.tsx", "dataSourceService.getStatus().isSupabase", "Supabase-only startup data effects");
  console.log("✓ Mock mode smoke test completed");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
